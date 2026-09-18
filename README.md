# Camera RTSP Platform

Nền tảng self-hosted để một máy chủ kết nối nhiều kênh từ NVR/camera qua RTSP, ghi hình liên tục, xem live/playback và nhận dạng người/xe. Toàn bộ chạy bằng Docker Compose.

## Luồng hoạt động

```text
NVR main stream ──> backend + FFmpeg ──┬─> HLS live ──> web admin
                                       └─> recording gốc (.ts) ──> playback
NVR sub-stream ──> AI worker (YOLO) ─────> event + snapshot
                                             │
                                      PostgreSQL + storage
```

- Main stream: ghi nguyên codec/chất lượng gốc.
- H.264 live: copy, ít tốn CPU. H.265 live: transcode H.264 để trình duyệt phát được.
- AI: nên dùng sub-stream 640p, 1–5 FPS để không ảnh hưởng recording.
- Event AI: mặc định nhận `person`, `car`, `motorcycle`, có ảnh snapshot và trang lọc sự kiện.

## Thành phần

| Service | Vai trò |
|---|---|
| `postgres` | User, camera, metadata recording và event AI |
| `backend` | API JWT, quản lý FFmpeg, retention recording |
| `web` | Web admin React: camera, live, playback, grid, sự kiện AI |
| `nginx` | Cổng web/API và phân phối HLS/recording/snapshot |
| `ai` | Python + YOLO, nhận dạng từ sub-stream |

## Triển khai trên Windows 11 Pro với Docker Desktop

Đây là cách phù hợp khi máy chủ camera chạy Windows 10/11 Pro. Docker Desktop phải dùng **Linux containers** và WSL 2; không chuyển sang Windows containers vì stack này dùng Alpine/Node/Python Linux.

### 1. Cài Docker Desktop và kiểm tra

Mở PowerShell **Run as Administrator**, cài WSL 2 nếu máy chưa có rồi khởi động lại khi Windows yêu cầu:

```powershell
wsl --install
```

Cài Docker Desktop, chọn backend **WSL 2** và Linux containers. Sau khi Docker Desktop báo `Engine running`, kiểm tra:

```powershell
docker version
docker compose version
```

Trong Docker Desktop > Settings > General, bật **Start Docker Desktop when you sign in**. Các container của project dùng `restart: unless-stopped`, nên chúng sẽ tự chạy lại khi Docker Desktop khởi động.

### 2. Clone code và tạo cấu hình

Dùng ổ còn nhiều dung lượng cho recording (ví dụ `D:` nếu có). Ví dụ dưới dùng `C:\CameraRTSP`:

```powershell
git clone https://github.com/ToesTuyen/camera-rtsp-platform.git C:\CameraRTSP
Set-Location C:\CameraRTSP
Copy-Item .env.example .env
New-Item -ItemType Directory -Force storage, models | Out-Null
notepad .env
```

Trong `.env`, đổi tối thiểu `POSTGRES_PASSWORD`, `DATABASE_URL` (chứa đúng cùng mật khẩu DB), `JWT_SECRET` và `ADMIN_PASSWORD` thành giá trị mạnh. Không commit file `.env` lên Git. Giữ `AI_DEVICE=cpu` nếu chưa chuẩn bị NVIDIA Container Toolkit/CUDA cho WSL 2.

Mặc định web dùng `HTTP_PORT=8080`. Nếu cổng này đã được chương trình khác dùng, chọn cổng trống như `HTTP_PORT=8081` và dùng cổng đó ở các bước sau.

### 3. Khởi chạy, kiểm tra và chỉ mở LAN

```powershell
Set-Location C:\CameraRTSP
docker compose config --quiet
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://localhost:8080/api/health
```

Kết quả mong đợi là `{"ok":true}`, năm service `postgres`, `backend`, `web`, `nginx`, `ai` đang `Up`, và PostgreSQL là `healthy`. Lần đầu AI tải model `yolov8n.pt` vào `models`.

Chỉ cho thiết bị trong LAN tin cậy truy cập web. Ví dụ LAN là `192.168.0.0/24` và đang dùng cổng 8080:

```powershell
New-NetFirewallRule -Name CameraRTSP-Web-LAN -DisplayName 'Camera RTSP Platform (LAN)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -RemoteAddress 192.168.0.0/24 -Profile Private
```

Mở `http://<IP-may-Windows>:8080` từ máy cùng LAN và đăng nhập bằng `ADMIN_USERNAME`/`ADMIN_PASSWORD` trong `.env`. Không public cổng này trực tiếp ra Internet; dùng VPN như WireGuard/Tailscale nếu cần truy cập ngoài site.

## Triển khai production trên Windows Server

Project dùng **Linux containers** (Alpine, Node, Python). Không cài Docker Desktop trực tiếp trên Windows Server: Docker xác nhận Docker Desktop không được hỗ trợ trên Windows Server, và Docker Engine native Windows chỉ chạy Windows containers, không chạy được stack này. Xem [Docker Desktop FAQ](https://docs.docker.com/desktop/troubleshoot-and-support/faqs/windowsfaqs/) và [Docker Engine trên Windows](https://docs.docker.com/engine/install/binaries/).

Phương án ổn định là:

```text
Windows Server 2022/2025 (Hyper-V host)
└── Ubuntu Server 24.04 LTS VM, external vSwitch, IP LAN cố định
    └── Docker Engine + Camera RTSP Platform (Linux containers)
```

VM phải dùng **External virtual switch** và một IP LAN riêng. Như vậy NVR, người xem và VM thấy nhau trực tiếp; tránh dùng Hyper-V Default Switch/NAT cho production.

### 1. Chuẩn bị Windows Server

Trên PowerShell chạy với quyền Administrator:

```powershell
Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart
```

Sau khi máy khởi động lại, tạo external vSwitch. Liệt kê đúng tên card mạng trước, rồi thay `<TEN_CARD_MANG>`:

```powershell
Get-NetAdapter
New-VMSwitch -Name "CameraLAN" -NetAdapterName "<TEN_CARD_MANG>" -AllowManagementOS $true
```

Trong Hyper-V Manager, tạo Ubuntu Server 24.04 LTS VM với:

- Generation 2, gắn ISO Ubuntu Server.
- Network Adapter nối vào `CameraLAN`.
- Tối thiểu 4 vCPU, 8 GB RAM; tăng theo số camera/transcode/AI.
- VHDX hệ điều hành riêng; gắn thêm VHDX lớn hoặc disk passthrough cho recording.
- Đặt DHCP reservation trên router cho VM, ví dụ `192.168.1.20`.

Windows Server 2022/2025 có thể cài WSL bằng `wsl --install`, nhưng WSL2 dùng NAT và IP có thể đổi. Dùng Ubuntu VM với external switch cho server camera sẽ dễ vận hành và kết nối NVR ổn định hơn. Tham khảo [hướng dẫn WSL cho Windows Server](https://learn.microsoft.com/en-us/windows/wsl/install-on-server).

### 2. Cài Docker Engine trong Ubuntu VM

SSH vào Ubuntu VM hoặc mở console Hyper-V. Các lệnh dưới đây theo [Docker Engine cho Ubuntu](https://docs.docker.com/engine/install/ubuntu/):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker
docker run --rm hello-world
docker compose version
```

### 3. Đặt code và storage trên ổ dữ liệu

Không lưu recording dài hạn vào disk hệ điều hành. Ví dụ đã mount ổ dữ liệu của VM tại `/srv/camera-data`:

```bash
sudo mkdir -p /srv/camera-rtsp-platform /srv/camera-data/{storage,models}
sudo chown -R "$USER":"$USER" /srv/camera-rtsp-platform /srv/camera-data
cd /srv/camera-rtsp-platform
git clone https://github.com/ToesTuyen/camera-rtsp-platform.git .
ln -s /srv/camera-data/storage storage
ln -s /srv/camera-data/models models
```

`storage/` chứa recording/live/snapshot. `models/` giữ weight AI đã tải để lần sau không phải tải lại. PostgreSQL nằm trong Docker volume; backup riêng ở bước bên dưới.

### 4. Tạo cấu hình production

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Ít nhất phải đổi các giá trị sau bằng chuỗi hex dài (không dùng ký tự `@`, `:`, `/` trong `POSTGRES_PASSWORD` vì nó xuất hiện trong URL DB):

```bash
openssl rand -hex 32   # POSTGRES_PASSWORD và ADMIN_PASSWORD
openssl rand -hex 48   # JWT_SECRET
```

Trong `.env`, đặt `POSTGRES_PASSWORD` và cập nhật **đúng cùng mật khẩu đó** vào `DATABASE_URL`. Ví dụ:

```dotenv
POSTGRES_USER=camadmin
POSTGRES_PASSWORD=<chuoi-hex-64-ky-tu>
POSTGRES_DB=camera_platform
DATABASE_URL=postgres://camadmin:<chuoi-hex-64-ky-tu>@postgres:5432/camera_platform
JWT_SECRET=<chuoi-hex-96-ky-tu>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<mat-khau-admin-manh>
HTTP_PORT=8080
RECORD_RETENTION_HOURS=720
RECORD_TIMEZONE=Asia/Ho_Chi_Minh
```

Giữ `AI_DEVICE=cpu` cho cấu hình mặc định. GPU NVIDIA cần một image CUDA phù hợp driver/CUDA của Linux server; không chỉ đổi biến môi trường là đủ.

### 5. Khởi chạy và kiểm tra

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 backend ai
curl http://localhost:8080/api/health
```

Kết quả mong đợi: năm service `postgres`, `backend`, `web`, `nginx`, `ai` ở trạng thái `Up`; PostgreSQL là `healthy`; health trả `{"ok":true}`. Lần đầu worker AI tải `yolov8n.pt` vào `models/`.

Từ máy quản trị trong LAN, mở `http://<IP_VM>:8080` và đăng nhập bằng `ADMIN_USERNAME`/`ADMIN_PASSWORD` trong `.env`.

### 6. Mở firewall đúng phạm vi

Chỉ mở cổng web cho LAN hoặc VPN tin cậy; không mở RTSP từ NVR ra Internet. Ví dụ LAN là `192.168.1.0/24`:

```bash
sudo apt-get install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow from 192.168.1.0/24 to any port 8080 proto tcp
sudo ufw enable
sudo ufw status
```

Nginx phân phối HLS/recording/snapshot để player chạy được, nên hãy xem cổng web là dữ liệu nhạy cảm: giới hạn firewall/VPN, không public trực tiếp lên Internet. Khi camera ở site khác, ưu tiên WireGuard hoặc Tailscale giữa NVR và VM thay vì port-forward RTSP.

## Kết nối NVR từ đầu đến cuối

1. Bảo đảm Ubuntu VM/NVR có route mạng tới nhau. Tạo user RTSP riêng trên NVR, chỉ quyền xem.
2. Lấy hai URL cho từng channel NVR:
   - **Main stream**: dùng cho recording chất lượng gốc.
   - **Sub-stream**: dùng cho AI, nên 640p và 1–5 FPS.
3. Ngay trong VM, kiểm tra main-stream trước khi thêm vào web:

   ```bash
   docker compose exec backend ffprobe -v error -rtsp_transport tcp -select_streams v:0 -show_entries stream=codec_name,width,height -of default=nw=1 "rtsp://<user>:<password>@<ip-nvr>:554/<duong-dan-main>"
   ```

4. Mở web → **Cameras** → **Add Camera**:
   - Nếu camera bật ONVIF: nhập URL device service (ví dụ `http://<ip-camera>/onvif/device_service`) cùng tài khoản ONVIF, bấm **Dò profile ONVIF** để tự điền main/sub-stream. Credential ONVIF không được lưu riêng; RTSP đã chọn vẫn là cấu hình stream của camera.
   - `RTSP URL`: main-stream.
   - `Recording`: bật.
   - `Codec`: `Auto` trước; chỉ chọn H.264/H.265 khi đã biết codec.
   - Bật **Nhận dạng AI**, điền `AI RTSP URL` là sub-stream, chọn FPS/ngưỡng/nhãn.
5. Camera phải chuyển sang `online`. Mở **Live** để xem HLS, **Playback** chọn ngày đã ghi, **Sự kiện AI** để xem event/snapshot, và **Multi-view** để chọn nhiều camera.

Nếu camera `error`, xem hai log sau trước:

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 ai
```

Các lỗi phổ biến: sai đường dẫn RTSP của NVR, VM không route tới NVR, NVR giới hạn số session, hoặc H.265 đang transcode quá nhiều luồng dẫn tới thiếu CPU.

## H.264, H.265 và AI

| Nguồn | Live web | Recording |
|---|---|---|
| H.264 | Copy | Copy codec gốc |
| H.265/HEVC | Transcode sang H.264 | Copy codec gốc |

Recording luôn copy codec gốc nên giữ chất lượng và ít CPU. H.265 chỉ tốn CPU khi một người đang xem live trên web. AI đọc sub-stream độc lập, có cooldown để giảm event trùng lặp; đây là nhận dạng đối tượng, không phải nhận diện khuôn mặt/biển số.

## Dung lượng, hiệu năng và lưu trữ

Ước tính recording: **10,8 GB/ngày cho mỗi 1 Mbps** bitrate. Ví dụ 16 camera × 4 Mbps cần khoảng 691 GB/ngày hoặc 20,7 TB cho 30 ngày, chưa tính RAID/dự phòng.

- Dùng ổ lớn riêng cho `storage/`; nên có RAID và backup ngoài máy cho dữ liệu quan trọng.
- Tăng `RECORD_RETENTION_HOURS` theo dung lượng thực tế.
- Giảm bitrate main stream trước khi giảm retention nếu cần tiết kiệm dung lượng.
- Dùng sub-stream AI. Nhiều luồng AI hoặc nhiều live H.265 cần server Linux/NVIDIA chuyên dụng; cấu hình CPU mặc định phù hợp để bắt đầu, không phải cam kết hiệu năng cho số camera không giới hạn.

## Vận hành, backup và cập nhật

```bash
# Xem trạng thái/log
docker compose ps
docker compose logs -f backend ai

# Cập nhật code rồi build lại
git pull --ff-only
docker compose up -d --build

# Backup PostgreSQL (chạy trong thư mục project)
mkdir -p backups
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backups/camera_platform-$(date +%F).sql

# Dừng (giữ DB và recording)
docker compose down

# NGUY HIỂM: xoá PostgreSQL volume, không xoá bind-mounted storage/
docker compose down -v
```

Backup `storage/` bằng công cụ backup filesystem/NAS theo lịch; không dùng `docker compose down -v` nếu chưa có backup DB.

## API

- `POST /api/auth/login`
- `GET/POST /api/cameras`, `GET/PUT/DELETE /api/cameras/:id`
- `POST /api/cameras/:id/start|stop`
- `POST /api/cameras/onvif/probe` — dò thông tin thiết bị, profile và RTSP URI qua ONVIF
- `GET /api/recordings/:cameraId/days`
- `GET /api/recordings/:cameraId/:day`
- `GET /api/events?cameraId=&from=&to=&label=&limit=`
- `GET /api/health`

## Cấu trúc dữ liệu

```text
storage/live/<cameraId>/              HLS live tạm thời
storage/rec/<cameraId>/<YYYYMMDD>/    Recording .ts và playlist
storage/events/<cameraId>/<YYYYMMDD>/ Snapshot AI
models/                               Weight YOLO
Docker volume pgdata                  PostgreSQL
```
