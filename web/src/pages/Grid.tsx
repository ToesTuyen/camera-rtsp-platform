import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, Camera } from '../api';
import HlsPlayer from '../HlsPlayer';
import Icon from '../Icon';

type LayoutSize = 1 | 4 | 9 | 16;

/** Live multi-view. Chỉ khởi tạo HLS cho các camera người dùng đã chọn. */
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
  const now = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());

  return (
    <section className="dashboard live-view">
      <div className="screen-toolbar live-toolbar">
        <details className="view-switcher">
          <summary><Icon name="monitor" size={20} />Chọn camera <Icon name="chevronDown" size={16} /></summary>
          <div className="view-options">
            {cameras.map((camera) => (
              <label key={camera.id}>
                <input type="checkbox" checked={selected.has(camera.id)} onChange={() => toggle(camera.id)} />
                <span className={`status-dot ${camera.status}`} />
                {camera.name}
              </label>
            ))}
            {cameras.length === 0 && <span className="sidebar-empty">Chưa có camera để chọn.</span>}
          </div>
        </details>
        <div className="layout-picker" role="group" aria-label="Bố cục Live view">
          <span>Bố cục</span>
          {([1, 4, 9, 16] as LayoutSize[]).map((size) => (
            <button key={size} type="button" className={layout === size ? 'active' : ''} onClick={() => setLayout(size)} title={`Hiển thị tối đa ${size} camera`}>
              {size === 1 ? '1' : size === 4 ? '2×2' : size === 9 ? '3×3' : '4×4'}
            </button>
          ))}
        </div>
        <div className="date-pill"><Icon name="clock" size={19} /><span>{now}</span></div>
      </div>

      {err && <div className="empty-dashboard"><div><Icon name="video" size={32} /><h2>Không tải được danh sách camera</h2><p>{err}</p></div></div>}

      {!err && visible.length === 0 && (
        <div className="empty-dashboard">
          <div>
            <Icon name="video" size={34} />
            <h2>Chưa có camera trong Live view</h2>
            <p>Thêm camera RTSP/ONVIF hoặc mở bộ chọn camera để đưa camera vào màn hình giám sát.</p>
            <Link to="/cameras">Quản lý camera</Link>
          </div>
        </div>
      )}

      {!err && visible.length > 0 && <>
        <div className={`camera-grid live-grid layout-${layout}`}>
          {visible.map((camera) => <CameraTile key={camera.id} camera={camera} />)}
        </div>
        <p className="live-grid-note">Đang hiển thị {visible.length}/{selected.size} camera đã chọn. Bố cục 4×4 xem cùng lúc tối đa 16 camera.</p>
      </>}
    </section>
  );
}

function CameraTile({ camera }: { camera: Camera }) {
  const offline = camera.status !== 'online';
  return (
    <article className="camera-tile">
      <header className="camera-tile-header">
        <Icon name="video" size={21} />
        <span className="camera-title">{camera.name}</span>
        <div className="tile-actions">
          <Link className="tile-icon-button" to={`/live?camera=${camera.id}`} title="Chỉ xem camera này"><Icon name="camera" size={19} /></Link>
          <Link className="tile-icon-button" to="/cameras" title="Cấu hình camera"><Icon name="settings" size={19} /></Link>
        </div>
      </header>
      <div className="camera-video">
        <HlsPlayer src={`/live/${camera.id}/index.m3u8`} live controls={false} />
        {offline && <div className="stream-offline"><span><i className={`status-dot ${camera.status}`} />{camera.status === 'connecting' ? 'Live RTSP đang kết nối…' : 'Live RTSP chưa online'}</span></div>}
      </div>
    </article>
  );
}
