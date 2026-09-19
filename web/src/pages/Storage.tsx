import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Camera, StorageStatus } from '../api';
import Icon from '../Icon';

export default function Storage() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [daysByCamera, setDaysByCamera] = useState<Record<number, string[]>>({});
  const [err, setErr] = useState('');

  async function load() {
    try {
      setErr('');
      const [nextStatus, nextCameras] = await Promise.all([api.storageStatus(), api.listCameras()]);
      setStatus(nextStatus);
      setCameras(nextCameras);
      const dayLists = await Promise.all(nextCameras.map(async (camera) => [camera.id, await api.recordingDays(camera.id)] as const));
      setDaysByCamera(Object.fromEntries(dayLists));
    } catch (error: any) {
      setErr(error.message);
    }
  }

  useEffect(() => { void load(); }, []);
  const warning = status && status.used_percent >= status.cleanup_threshold_percent;

  return (
    <section className="page-card storage-page">
      <div className="page-heading">
        <div><span className="eyebrow">Video đã lưu</span><h2>Playback</h2><p>Chọn camera có recording để xem lại video đã lưu tại <b>{status?.label ?? 'storage'}</b>.</p></div>
        <button className="dark-button" onClick={() => void load()}><Icon name="rewind" size={17} />Làm mới</button>
      </div>
      {err && <p className="form-error">{err}</p>}
      {status && <>
        <div className="storage-summary">
          <div className="storage-donut" style={{ '--usage': `${Math.min(100, status.used_percent)}%` } as React.CSSProperties}><span>{status.used_percent}%<small>đã dùng</small></span></div>
          <div className="storage-numbers"><strong>{formatBytes(status.used_bytes)} <span>/ {formatBytes(status.total_bytes)}</span></strong><p>Còn trống {formatBytes(status.free_bytes)} · recording đang chiếm {formatBytes(status.recording_bytes)}</p><div className={`storage-bar ${warning ? 'warning' : ''}`}><span style={{ width: `${Math.min(100, status.used_percent)}%` }} /></div></div>
          <div className="storage-policy"><Icon name="clock" size={21} /><div><b>Tự dọn ở {status.cleanup_threshold_percent}%</b><span>Khi ổ chứa storage đạt ngưỡng, hệ thống xoá từng ngày recording cũ nhất đến {status.cleanup_target_percent}%. Không xoá live, snapshot AI hoặc ngày đang ghi.</span></div></div>
        </div>
        {warning && <div className="storage-alert">Dung lượng đã chạm ngưỡng. Job dọn dẹp đang kiểm tra các ngày recording đã hoàn tất; làm mới sau vài phút để xem số liệu mới.</div>}
        <div className="recording-library-header"><div><h3>Camera có recording</h3><p>{status.recording_days} ngày recording đang sẵn sàng xem lại.</p></div><span>{cameras.length} camera</span></div>
      </>}
      <div className="recording-library">
        {cameras.map((camera) => {
          const days = daysByCamera[camera.id] ?? [];
          return <article className="recording-camera" key={camera.id}><div><Icon name="video" size={20} /><div><strong>{camera.name}</strong><span>{days.length ? `${days.length} ngày có recording` : 'Chưa có recording'}</span></div></div>{days[0] ? <Link to={`/playback/${camera.id}`} className="row-link">Xem lại <Icon name="play" size={15} /></Link> : <span className="row-muted">Chờ ghi hình</span>}</article>;
        })}
        {cameras.length === 0 && <p className="empty-library">Chưa có camera. Vào <Link to="/cameras">Camera</Link> để thêm RTSP hoặc dò ONVIF.</p>}
      </div>
    </section>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
  return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[unit]}`;
}
