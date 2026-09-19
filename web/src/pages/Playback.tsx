import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, Camera, RecordingSegment } from '../api';
import HlsPlayer from '../HlsPlayer';
import Icon from '../Icon';

export default function Playback() {
  const { id } = useParams();
  const cameraId = Number(id);
  const [cam, setCam] = useState<Camera | null>(null);
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
    api.recordingDays(cameraId).then((availableDays) => {
      setDays(availableDays);
      if (availableDays[0]) setDay(availableDays[0]);
    }).catch((error) => setErr(error.message));
  }, [cameraId]);

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
    }).catch((error) => setErr(error.message));
  }, [cameraId, day]);

  useEffect(() => {
    if (!day || !originalPlaylist) return;
    if (cam?.codec !== 'h265') {
      setPreparing(false);
      setPlaylist(originalPlaylist);
      return;
    }
    // Mở đoạn mới nhất trước để có hình nhanh; các mốc còn lại được chuyển khi bấm.
    const segment = requestedSegment || segments[segments.length - 1]?.file;
    if (!segment) return;
    let cancelled = false;
    let timer: number | undefined;
    const prepare = async () => {
      try {
        setPreparing(true);
        const state = await api.prepareBrowserPlayback(cameraId, day, segment);
        if (cancelled) return;
        if (state.playlist) setPlaylist(state.playlist);
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

  function playFrom(segment: RecordingSegment, index: number) {
    setActive(segment.file);
    if (cam?.codec === 'h265') {
      setStartPosition(-1);
      setPlaylist(null);
      setRequestedSegment(segment.file);
      return;
    }
    setStartPosition(-1);
    setPlaylist(api.recordingPlaylist(cameraId, day, segment.file));
  }

  return (
    <section className="page-card playback-page">
      <div className="playback-heading">
        <div>
          <Link to="/storage" className="back-link">← Storage</Link>
          <h2>{cam?.name ?? `Camera ${id}`}</h2>
          <p>Chọn ngày và mốc thời gian để xem lại recording. Với H.265, hệ thống tạo HLS H.264 cho đoạn bạn chọn nhưng vẫn giữ nguyên video gốc.</p>
        </div>
        <div className="playback-day-picker"><Icon name="clock" size={18} /><select value={day} onChange={(event) => setDay(event.target.value)} disabled={days.length === 0}>
          {days.length === 0 && <option>Chưa có recording</option>}
          {days.map((value) => <option key={value} value={value}>{formatDay(value)}</option>)}
        </select></div>
      </div>

      {err && <p className="form-error">{err}</p>}
      {days.length === 0 && !err && <div className="playback-empty"><Icon name="clock" size={30} /><h3>Chưa có video đã ghi</h3><p>Hãy kiểm tra camera đang bật, trạng thái online và tùy chọn ghi hình (record).</p><Link to="/cameras">Mở cấu hình camera</Link></div>}

      {days.length > 0 && <>
        <div className="playback-player">
          {playlist ? <HlsPlayer key={`${playlist}-${startPosition}`} src={playlist} startPosition={startPosition} /> : <div className="playback-empty"><Icon name="video" size={30} /><p>{preparing ? 'Đang tạo bản phát H.264 cho đoạn đã chọn để browser có thể play và seek…' : 'Không có playlist cho ngày đã chọn.'}</p></div>}
        </div>
        {preparing && <p className="playback-preparing"><Icon name="clock" size={16} />Đang chuẩn bị playback H.264 cho mốc đã chọn; player sẽ tự sẵn sàng.</p>}
        <div className="recording-timeline">
          <div className="recording-timeline-header"><div><h3>Dòng thời gian</h3><p>{segments.length} segment · {formatBytes(segments.reduce((total, segment) => total + segment.size, 0))}</p></div><button className="dark-button" disabled={!playlist} onClick={() => { setActive(''); setStartPosition(0); setPlaylist(cam?.codec === 'h265' ? playlist : `/rec/${cameraId}/${day}/index.m3u8`); }}><Icon name="play" size={16} />Phát từ đầu ngày</button></div>
          <div className="segment-track" role="list" aria-label="Các đoạn recording">
            {segments.map((segment, index) => <button key={segment.file} role="listitem" disabled={!playlist} className={`recording-segment ${active === segment.file ? 'active' : ''}`} onClick={() => playFrom(segment, index)} title={`${formatTime(segment)} · ${formatBytes(segment.size)}`} style={{ '--segment-width': `${Math.max(3, 100 / Math.max(segments.length, 1))}%` } as React.CSSProperties}>
              <span>{index % Math.max(1, Math.ceil(segments.length / 8)) === 0 ? formatTime(segment) : ''}</span>
            </button>)}
          </div>
          <p className="timeline-help">Bấm một block màu xanh để nhảy tới đúng mốc. Bản H.265 gốc không bị thay đổi; web chuyển riêng đoạn bạn chọn sang H.264 để phát ngay.</p>
        </div>
        <details className="segment-details">
          <summary>Chi tiết file ({segments.length}) <Icon name="chevronDown" size={17} /></summary>
          <div>{segments.map((segment, index) => <button key={segment.file} disabled={!playlist} onClick={() => playFrom(segment, index)}><span>{formatTime(segment)}</span><b>{segment.file}</b><small>{formatBytes(segment.size)}</small></button>)}</div>
        </details>
      </>}
    </section>
  );
}

function formatDay(value: string): string {
  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
}

function formatTime(segment: RecordingSegment): string {
  if (!segment.started_at) return segment.file;
  return segment.started_at.slice(11, 16);
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
