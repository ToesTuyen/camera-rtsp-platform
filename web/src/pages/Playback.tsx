import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, Camera } from '../api';
import HlsPlayer from '../HlsPlayer';

export default function Playback() {
  const { id } = useParams();
  const cameraId = Number(id);
  const [cam, setCam] = useState<Camera | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [day, setDay] = useState<string>('');
  const [playlist, setPlaylist] = useState<string | null>(null);
  const [segments, setSegments] = useState<any[]>([]);

  useEffect(() => {
    api.getCamera(cameraId).then(setCam).catch(() => undefined);
    api.recordingDays(cameraId).then((d) => {
      setDays(d);
      if (d.length > 0) setDay(d[0]);
    });
  }, [cameraId]);

  useEffect(() => {
    if (!day) return;
    api.recordingDay(cameraId, day).then((r) => {
      setPlaylist(r.playlist);
      setSegments(r.segments);
    });
  }, [cameraId, day]);

  function fmtDay(d: string) {
    // 20260911 -> 2026-09-11
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }

  return (
    <div>
      <Link to="/" style={{ color: '#2563eb' }}>&larr; Danh sách camera</Link>
      <h2>Playback: {cam?.name ?? `Camera ${id}`}</h2>

      {days.length === 0 && <p style={{ color: '#888' }}>Chưa có bản ghi nào.</p>}

      {days.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label>Ngày: </label>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>{fmtDay(d)}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ maxWidth: 900 }}>
        {playlist ? (
          <HlsPlayer key={playlist} src={playlist} />
        ) : (
          day && <p style={{ color: '#888' }}>Không có playlist cho ngày này.</p>
        )}
      </div>

      {segments.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4>Các đoạn ghi ({segments.length})</h4>
          <ul style={{ maxHeight: 200, overflow: 'auto', fontSize: 13 }}>
            {segments.map((s) => (
              <li key={s.file}>
                <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                  {s.file}
                </a>{' '}
                ({(s.size / 1e6).toFixed(1)} MB)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
