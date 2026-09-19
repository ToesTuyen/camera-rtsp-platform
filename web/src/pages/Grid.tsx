import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, Camera } from '../api';
import HlsPlayer from '../HlsPlayer';
import Icon from '../Icon';

type LayoutSize = 1 | 4 | 9 | 16;

export default function Grid() {
  const [searchParams] = useSearchParams();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [layout, setLayout] = useState<LayoutSize>(1);
  const [featuredCameraId, setFeaturedCameraId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const focusedCameraId = Number(searchParams.get('camera'));

  useEffect(() => {
    api.listCameras().then((items) => {
      setCameras(items);
      const enabled = items.filter((camera) => camera.enabled);
      const focused = enabled.find((camera) => camera.id === focusedCameraId);
      setSelected(new Set((focused ? [focused] : enabled.slice(0, 16)).map((camera) => camera.id)));
      setFeaturedCameraId((focused ?? enabled[0])?.id ?? null);
    }).catch((error) => setErr(error.message));
  }, [focusedCameraId]);

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (!next.has(featuredCameraId ?? -1)) setFeaturedCameraId(Array.from(next)[0] ?? null);
      return next;
    });
  }

  const selectedCameras = useMemo(
    () => cameras.filter((camera) => selected.has(camera.id)),
    [cameras, selected]
  );
  const featuredCamera = selectedCameras.find((camera) => camera.id === featuredCameraId) ?? selectedCameras[0];
  const visible = useMemo(
    () => selectedCameras.slice(0, layout),
    [layout, selectedCameras]
  );
  const now = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());

  return (
    <section className="mi-live-page">
      <header className="mi-page-header">
        <div><span className="eyebrow">Không gian của bạn</span><h1>Camera</h1><p>{now} · Theo dõi ngôi nhà trong thời gian thực.</p></div>
        <div className="mi-live-actions">
          <details className="mi-camera-picker">
            <summary><Icon name="video" size={18} />{selected.size} camera <Icon name="chevronDown" size={15} /></summary>
            <div>{cameras.map((camera) => <label key={camera.id}><input type="checkbox" checked={selected.has(camera.id)} onChange={() => toggle(camera.id)} /><i className={`status-dot ${camera.status}`} />{camera.name}</label>)}</div>
          </details>
          <div className="mi-layout-picker" role="group" aria-label="Bố cục camera">
            {([1, 4, 9, 16] as LayoutSize[]).map((size) => <button key={size} className={layout === size ? 'active' : ''} type="button" onClick={() => setLayout(size)} title={`Bố cục ${size} camera`}>{size === 1 ? '1' : size === 4 ? '2×2' : size === 9 ? '3×3' : '4×4'}</button>)}
          </div>
        </div>
      </header>

      {err && <div className="mi-notice error">Không tải được camera: {err}</div>}
      {!err && selectedCameras.length === 0 && <div className="mi-empty-state"><Icon name="camera" size={36} /><h2>Chưa có camera trong màn hình</h2><p>Thêm camera RTSP/ONVIF hoặc chọn camera ở bộ lọc phía trên.</p><Link to="/cameras">Thêm camera</Link></div>}
      {!err && selectedCameras.length > 0 && layout === 1 && featuredCamera && <FocusView camera={featuredCamera} cameras={selectedCameras} onChoose={setFeaturedCameraId} />}
      {!err && selectedCameras.length > 0 && layout !== 1 && <>
        <div className={`mi-camera-grid layout-${layout}`}>
          {visible.map((camera) => <CameraTile key={camera.id} camera={camera} />)}
        </div>
        <p className="mi-live-footer">{visible.length} trong {selected.size} camera đang chọn · Video H.265 được chuyển đổi an toàn để phát trên trình duyệt.</p>
      </>}
    </section>
  );
}

function FocusView({ camera, cameras, onChoose }: { camera: Camera; cameras: Camera[]; onChoose: (id: number) => void }) {
  const offline = camera.status !== 'online';
  return (
    <>
      <section className="mi-live-focus">
        <article className="mi-featured-camera">
          <div className="mi-featured-video">
            <HlsPlayer src={`/live/${camera.id}/index.m3u8`} live controls={false} />
            {offline && <div className="mi-stream-state"><i className={`status-dot ${camera.status}`} />{camera.status === 'connecting' ? 'Đang kết nối camera' : 'Camera chưa online'}</div>}
            <div className="mi-featured-title"><i className={`status-dot ${camera.status}`} /><div><span>LIVE CAMERA</span><strong>{camera.name}</strong></div></div>
          </div>
        </article>
        <aside className="mi-device-panel">
          <div className="mi-device-panel-top"><span className="eyebrow">Thiết bị đang chọn</span><span className={`mi-status-label ${camera.status}`}>{camera.status === 'online' ? 'Online' : camera.status}</span></div>
          <h2>{camera.name}</h2>
          <p>Camera giám sát trong không gian của bạn, phát trực tiếp qua kết nối bảo mật.</p>
          <dl><div><dt>Địa chỉ</dt><dd>{cameraHost(camera.rtsp_url)}</dd></div><div><dt>Video</dt><dd>{camera.codec.toUpperCase()}</dd></div><div><dt>Ghi hình</dt><dd>{camera.record ? 'Đang bật' : 'Đã tắt'}</dd></div></dl>
          <div className="mi-device-quick-actions"><Link to={`/playback/${camera.id}`}><Icon name="clock" size={17} />Xem lại</Link><Link to="/cameras"><Icon name="settings" size={17} />Quản lý</Link></div>
          <div className="mi-device-tip"><Icon name="video" size={17} /><span>Chọn một camera phía dưới để chuyển màn hình chính.</span></div>
        </aside>
      </section>
      <section className="mi-camera-carousel" aria-label="Chuyển camera">
        <div><span className="eyebrow">Camera trong nhà</span><strong>{cameras.length} thiết bị</strong></div>
        <div className="mi-carousel-items">{cameras.map((item) => <button key={item.id} type="button" className={item.id === camera.id ? 'active' : ''} onClick={() => onChoose(item.id)}><i className={`status-dot ${item.status}`} /><span>{item.name}</span><small>{item.status === 'online' ? 'Đang phát' : item.status}</small></button>)}</div>
      </section>
    </>
  );
}

function cameraHost(url: string): string {
  try { return new URL(url).hostname; } catch { return 'Camera RTSP'; }
}

function CameraTile({ camera }: { camera: Camera }) {
  const offline = camera.status !== 'online';
  return (
    <article className="mi-camera-card">
      <div className="mi-camera-video">
        <HlsPlayer src={`/live/${camera.id}/index.m3u8`} live controls={false} />
        {offline && <div className="mi-stream-state"><i className={`status-dot ${camera.status}`} />{camera.status === 'connecting' ? 'Đang kết nối' : 'Camera chưa online'}</div>}
        <div className="mi-camera-overlay">
          <div><i className={`status-dot ${camera.status}`} /><strong>{camera.name}</strong><small>Live · {camera.status}</small></div>
          <div className="mi-camera-card-actions"><Link to={`/live?camera=${camera.id}`} title="Chỉ xem camera này"><Icon name="monitor" size={17} /></Link><Link to={`/playback/${camera.id}`} title="Xem Playback"><Icon name="clock" size={17} /></Link></div>
        </div>
      </div>
    </article>
  );
}
