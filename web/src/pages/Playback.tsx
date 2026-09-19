import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, Camera, RecordingSegment } from '../api';
import HlsPlayer from '../HlsPlayer';
import Icon from '../Icon';

/** Giao diện Playback kiểu đầu ghi: chọn camera + ngày + mốc trên timeline. */
export default function Playback() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const cameraId = Number(id);
  const requestedDay = searchParams.get('day') ?? '';
  const requestedFile = searchParams.get('segment') ?? '';
  const [cam, setCam] = useState<Camera | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [day, setDay] = useState('');
  const [originalPlaylist, setOriginalPlaylist] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<string | null>(null);
  const [segments, setSegments] = useState<RecordingSegment[]>([]);
  const [active, setActive] = useState('');
  const [requestedSegment, setRequestedSegment] = useState('');
  const [startPosition, setStartPosition] = useState(-1);
  const [preparing, setPreparing] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!Number.isFinite(cameraId)) return;
    api.getCamera(cameraId).then(setCam).catch((error) => setErr(error.message));
    api.listCameras().then(setCameras).catch(() => setCameras([]));
    api.recordingDays(cameraId).then((availableDays) => {
      setDays(availableDays);
      if (availableDays.includes(requestedDay)) setDay(requestedDay);
      else if (availableDays[0]) setDay(availableDays[0]);
    }).catch((error) => setErr(error.message));
  }, [cameraId, requestedDay]);

  useEffect(() => {
    if (!day) return;
    setErr('');
    setActive('');
    setRequestedSegment('');
    setStartPosition(-1);
    setOriginalPlaylist(null);
    setPlaylist(null);
    api.recordingDay(cameraId, day).then((recording) => {
      setOriginalPlaylist(recording.playlist);
      setSegments(recording.segments);
      const selected = recording.segments.find((segment) => segment.file === requestedFile);
      if (selected) {
        setActive(selected.file);
        setRequestedSegment(selected.file);
      }
    }).catch((error) => setErr(error.message));
  }, [cameraId, day, requestedFile]);

  useEffect(() => {
    if (!day || !originalPlaylist) return;
    if (cam?.codec !== 'h265') {
      setPreparing(false);
      setPlaylist(requestedSegment ? api.recordingPlaylist(cameraId, day, requestedSegment) : originalPlaylist);
      return;
    }
    // HEVC không seek ổn định trên Chrome/Edge; chỉ chuẩn bị segment local đang chọn.
    const segment = requestedSegment || segments[segments.length - 1]?.file;
    if (!segment) return;
    if (!requestedSegment) setActive(segment);
    let cancelled = false;
    let timer: number | undefined;
    const prepare = async () => {
      try {
        setPreparing(true);
        const state = await api.prepareBrowserPlayback(cameraId, day, segment);
        if (cancelled) return;
        if (state.playlist) {
          setPlaylist(state.playlist);
          setStartPosition(state.start_position ?? -1);
        }
        if (state.status === 'processing') {
          timer = window.setTimeout(prepare, 3000);
          return;
        }
        setPreparing(false);
        if (state.status === 'error') setErr(state.error ?? 'Không thể chuyển recording H.265 cho browser');
      } catch (error: any) {
        if (!cancelled) {
          setPreparing(false);
          setErr(error.message);
        }
      }
    };
    void prepare();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [cam?.codec, cameraId, day, originalPlaylist, requestedSegment, segments]);

  const activeIndex = useMemo(() => segments.findIndex((segment) => segment.file === active), [active, segments]);
  const activeSegment = activeIndex >= 0 ? segments[activeIndex] : undefined;

  function playFrom(segment: RecordingSegment) {
    setActive(segment.file);
    if (cam?.codec === 'h265') {
      setStartPosition(-1);
      setPlaylist(null);
      setRequestedSegment(segment.file);
      return;
    }
    setStartPosition(-1);
    setRequestedSegment(segment.file);
    setPlaylist(api.recordingPlaylist(cameraId, day, segment.file));
  }

  function selectOffset(offset: number) {
    const base = activeIndex >= 0 ? activeIndex : segments.length - 1;
    const next = segments[Math.min(segments.length - 1, Math.max(0, base + offset))];
    if (next) playFrom(next);
  }

  return (
    <section className="page-card playback-page">
      <div className="playback-shell">
        <aside className="playback-camera-rail" aria-label="Chọn camera playback">
          <div className="playback-rail-heading"><Icon name="video" size={19} /><span>Camera</span></div>
          <div className="playback-camera-list">
            {cameras.map((camera) => (
              <Link key={camera.id} to={`/playback/${camera.id}`} className={camera.id === cameraId ? 'active' : ''}>
                <i className={`status-dot ${camera.status}`} />
                <span>{camera.name}</span>
                <Icon name="play" size={13} />
              </Link>
            ))}
            {cameras.length === 0 && <span className="rail-empty">Chưa có camera.</span>}
          </div>
          <Link to="/playback" className="rail-back">← Danh sách recording</Link>
        </aside>

        <div className="playback-workspace">
          <div className="playback-heading cctv-playback-heading">
            <div>
              <span className="eyebrow">Playback local</span>
              <h2>{cam?.name ?? `Camera ${id}`}</h2>
              <p>Video đọc từ recording đã lưu. Dùng timeline để chọn mốc; thanh điều khiển trên video dùng để play, pause và seek.</p>
            </div>
            <div className="playback-day-picker"><Icon name="clock" size={18} /><select value={day} onChange={(event) => setDay(event.target.value)} disabled={days.length === 0}>
              {days.length === 0 && <option>Chưa có recording</option>}
              {days.map((value) => <option key={value} value={value}>{formatDay(value)}</option>)}
            </select></div>
          </div>

          {days.length > 1 && <div className="playback-day-strip" aria-label="Ngày có recording">
            {days.map((value) => <button key={value} type="button" onClick={() => setDay(value)} className={value === day ? 'active' : ''}>{formatDayShort(value)}</button>)}
          </div>}

          {err && <p className="form-error">{err}</p>}
          {days.length === 0 && !err && <div className="playback-empty"><Icon name="clock" size={30} /><h3>Chưa có video đã ghi</h3><p>Hãy kiểm tra camera đang bật, trạng thái online và tùy chọn ghi hình.</p><Link to="/cameras">Mở cấu hình camera</Link></div>}

          {days.length > 0 && <>
            <div className="playback-player cctv-playback-player">
              {playlist ? <HlsPlayer key={`${playlist}-${startPosition}`} src={playlist} startPosition={startPosition} /> : <div className="playback-empty"><Icon name="video" size={30} /><p>{preparing ? 'Đang chuyển file local H.265 của mốc đã chọn sang H.264 để browser có thể phát và seek…' : 'Không có playlist cho ngày đã chọn.'}</p></div>}
            </div>
            {preparing && <p className="playback-preparing"><Icon name="clock" size={16} />Đang xử lý file local, không kết nối lại RTSP/camera. Mốc này sẽ được cache để mở lại nhanh hơn.</p>}

            <section className="recording-timeline cctv-timeline" aria-label="Timeline playback">
              <div className="recording-timeline-header">
                <div><h3>Dòng thời gian {formatDay(day)}</h3><p>{segments.length} segment · {formatBytes(segments.reduce((total, segment) => total + segment.size, 0))}</p></div>
                <span className="cctv-time-readout">{activeSegment ? formatTime(activeSegment) : 'Chọn mốc thời gian'}</span>
              </div>
              <div className="cctv-playback-controls">
                <button type="button" onClick={() => selectOffset(-segments.length)} disabled={segments.length === 0} title="Đầu ngày"><Icon name="skipBack" size={18} /></button>
                <button type="button" onClick={() => selectOffset(-1)} disabled={activeIndex <= 0} title="Mốc trước"><Icon name="rewind" size={18} /></button>
                <button type="button" onClick={() => activeSegment ? playFrom(activeSegment) : selectOffset(0)} disabled={segments.length === 0} title="Phát mốc đang chọn"><Icon name="play" size={19} /></button>
                <button type="button" onClick={() => selectOffset(1)} disabled={activeIndex < 0 || activeIndex >= segments.length - 1} title="Mốc sau"><Icon name="skipForward" size={18} /></button>
                <button type="button" onClick={() => selectOffset(segments.length)} disabled={segments.length === 0} title="Mốc mới nhất"><Icon name="skipForward" size={18} /></button>
              </div>
              <div className="segment-track cctv-segment-track" role="list" aria-label="Các đoạn recording">
                {segments.map((segment, index) => <button key={segment.file} role="listitem" className={`recording-segment ${active === segment.file ? 'active' : ''}`} onClick={() => playFrom(segment)} title={`${formatTime(segment)} · ${formatBytes(segment.size)}`} style={{ '--segment-width': `${Math.max(3, 100 / Math.max(segments.length, 1))}%` } as React.CSSProperties}>
                  <span>{index % Math.max(1, Math.ceil(segments.length / 8)) === 0 ? formatTime(segment) : ''}</span>
                </button>)}
              </div>
              <p className="timeline-help">Bấm một block màu xanh để xem đúng mốc local. Với H.265, lần đầu hệ thống chuyển riêng đoạn chọn sang H.264; các lần sau dùng bản cache.</p>
            </section>

            <details className="segment-details">
              <summary>Danh sách file ({segments.length}) <Icon name="chevronDown" size={17} /></summary>
              <div>{segments.map((segment) => <button key={segment.file} onClick={() => playFrom(segment)}><span>{formatTime(segment)}</span><b>{segment.file}</b><small>{formatBytes(segment.size)}</small></button>)}</div>
            </details>
          </>}
        </div>
      </div>
    </section>
  );
}

function formatDay(value: string): string {
  if (!value) return '';
  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
}

function formatDayShort(value: string): string {
  return `${value.slice(6, 8)}/${value.slice(4, 6)}`;
}

function formatTime(segment: RecordingSegment): string {
  return segment.started_at ? segment.started_at.slice(11, 16) : segment.file;
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
