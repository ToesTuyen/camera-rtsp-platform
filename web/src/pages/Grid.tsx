import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Camera, RecordingSegment } from '../api';
import HlsPlayer from '../HlsPlayer';
import Icon from '../Icon';

/** Dashboard live multi-view. Chỉ khởi tạo HLS cho các camera người dùng đã chọn. */
export default function Grid() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [err, setErr] = useState('');

  useEffect(() => {
    api.listCameras().then((items) => {
      setCameras(items);
      setSelected(new Set(items.filter((camera) => camera.enabled).slice(0, 6).map((camera) => camera.id)));
    }).catch((error) => setErr(error.message));
  }, []);

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visible = useMemo(() => cameras.filter((camera) => selected.has(camera.id)), [cameras, selected]);
  const gridClass = visible.length === 1 ? 'grid-one' : visible.length === 2 ? 'grid-two' : visible.length >= 3 ? 'grid-featured' : '';
  const now = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());

  return (
    <section className="dashboard">
      <div className="screen-toolbar">
        <details className="view-switcher">
          <summary><Icon name="monitor" size={20} />View 01 <Icon name="chevronDown" size={16} /></summary>
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
        <div className="date-pill"><Icon name="clock" size={19} /><span>{now}</span></div>
      </div>

      {err && <div className="empty-dashboard"><div><Icon name="video" size={32} /><h2>Không tải được danh sách camera</h2><p>{err}</p></div></div>}

      {!err && visible.length === 0 && (
        <div className="empty-dashboard">
          <div>
            <Icon name="video" size={34} />
            <h2>Chưa có camera trong View 01</h2>
            <p>Thêm camera RTSP/ONVIF hoặc mở bộ chọn View 01 để đưa camera vào màn hình giám sát.</p>
            <Link to="/cameras">Quản lý camera</Link>
          </div>
        </div>
      )}

      {!err && visible.length > 0 && <>
        <div className={`camera-grid ${gridClass}`}>
          {visible.map((camera) => <CameraTile key={camera.id} camera={camera} />)}
        </div>
        <Timeline camera={visible[0]} />
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
          <Link className="tile-icon-button" to={`/live/${camera.id}`} title="Mở camera"><Icon name="camera" size={19} /></Link>
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

function Timeline({ camera }: { camera: Camera }) {
  const [day, setDay] = useState('');
  const [segments, setSegments] = useState<RecordingSegment[]>([]);

  useEffect(() => {
    let cancelled = false;
    setDay('');
    setSegments([]);
    api.recordingDays(camera.id)
      .then(async (days) => {
        const latestDay = days[0];
        if (!latestDay) return;
        const recording = await api.recordingDay(camera.id, latestDay);
        if (cancelled) return;
        setDay(latestDay);
        setSegments(recording.segments);
      })
      .catch(() => {
        // Dashboard vẫn dùng được khi API recording tạm thời lỗi; chi tiết lỗi nằm ở Playback.
      });
    return () => { cancelled = true; };
  }, [camera.id]);

  const playbackHref = (segment?: RecordingSegment) => {
    const query = new URLSearchParams();
    if (day) query.set('day', day);
    if (segment) query.set('segment', segment.file);
    const suffix = query.toString();
    return `/playback/${camera.id}${suffix ? `?${suffix}` : ''}`;
  };

  return (
    <section className="timeline-panel" aria-label="Điều khiển playback">
      <div className="timeline-controls">
        <div className="timeline-select"><Icon name="video" size={18} /><span>{camera.name} · local</span></div>
        <div className="playback-actions">
          <Link to={playbackHref(segments[segments.length - 1])} className="timeline-button" title="Mở Playback từ recording local"><Icon name="play" size={21} /></Link>
          <Link to={playbackHref()} className="timeline-open-playback">Mở Playback local</Link>
        </div>
        <div className="zoom-controls"><b>{day ? `${segments.length} đoạn đã lưu` : 'Đang đọc recording…'}</b></div>
      </div>
      <div className="timeline-track">
        <div className="timeline-times"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
        <div className="timeline-ruler" />
        <div className="timeline-recordings">
          {segments.map((segment, index) => (
            <Link
              key={segment.file}
              to={playbackHref(segment)}
              className="dashboard-recording-segment"
              title={`Xem lại local từ ${formatTime(segment)}`}
              style={{ '--recording-width': `${Math.max(6, 100 / Math.max(segments.length, 1))}%` } as React.CSSProperties}
            >
              {index % Math.max(1, Math.ceil(segments.length / 6)) === 0 && <span>{formatTime(segment)}</span>}
            </Link>
          ))}
          {day && segments.length === 0 && <span className="timeline-no-recording">Chưa có segment recording hoàn chỉnh.</span>}
        </div>
      </div>
      <p className="timeline-local-note">Các block xanh là file đã lưu trong Documents. Bấm một block để mở đúng mốc Playback; trạng thái Live RTSP phía trên không ảnh hưởng việc xem lại.</p>
    </section>
  );
}

function formatTime(segment: RecordingSegment): string {
  return segment.started_at ? segment.started_at.slice(11, 16) : segment.file;
}
