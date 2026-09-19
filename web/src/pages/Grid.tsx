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
  const [layout, setLayout] = useState<LayoutSize>(4);
  const [err, setErr] = useState('');
  const focusedCameraId = Number(searchParams.get('camera'));

  useEffect(() => {
    api.listCameras().then((items) => {
      setCameras(items);
      const enabled = items.filter((camera) => camera.enabled);
      const focused = enabled.find((camera) => camera.id === focusedCameraId);
      setSelected(new Set((focused ? [focused] : enabled.slice(0, 16)).map((camera) => camera.id)));
    }).catch((error) => setErr(error.message));
  }, [focusedCameraId]);

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visible = useMemo(
    () => cameras.filter((camera) => selected.has(camera.id)).slice(0, layout),
    [cameras, layout, selected]
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
      {!err && visible.length === 0 && <div className="mi-empty-state"><Icon name="camera" size={36} /><h2>Chưa có camera trong màn hình</h2><p>Thêm camera RTSP/ONVIF hoặc chọn camera ở bộ lọc phía trên.</p><Link to="/cameras">Thêm camera</Link></div>}
      {!err && visible.length > 0 && <>
        <div className={`mi-camera-grid layout-${layout}`}>
          {visible.map((camera) => <CameraTile key={camera.id} camera={camera} />)}
        </div>
        <p className="mi-live-footer">{visible.length} trong {selected.size} camera đang chọn · Video H.265 được chuyển đổi an toàn để phát trên trình duyệt.</p>
      </>}
    </section>
  );
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
