import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, Camera, DetectionEvent } from '../api';
import HlsPlayer from '../HlsPlayer';

export default function Live() {
  const { id } = useParams();
  const [cam, setCam] = useState<Camera | null>(null);
  const [events, setEvents] = useState<DetectionEvent[]>([]);

  useEffect(() => {
    if (id) {
      const cameraId = Number(id);
      api.getCamera(cameraId).then(setCam).catch(() => undefined);
      api.listEvents({ cameraId, limit: 6 }).then(setEvents).catch(() => undefined);
    }
  }, [id]);

  const liveUrl = `/live/${id}/index.m3u8`;

  return (
    <section className="page-card live-page">
      <Link to="/" style={{ color: '#2563eb' }}>&larr; Danh sách camera</Link>
      <h2>Live: {cam?.name ?? `Camera ${id}`}</h2>
      <p style={{ color: '#666' }}>Trạng thái: {cam?.status}</p>
      <div style={{ maxWidth: 900 }}>
        <HlsPlayer src={liveUrl} live />
      </div>
      <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
        Live stream qua HLS (độ trễ ~5-10s). Nếu chưa hiện hình, camera có thể đang kết nối — đợi vài giây và tải lại.
      </p>
      {cam?.ai_enabled && (
        <section style={{ marginTop: 22 }}>
          <h3>Sự kiện nhận dạng gần đây</h3>
          {events.length === 0 ? <p style={{ color: '#888' }}>Chưa có sự kiện.</p> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {events.map((event) => <div key={event.id} style={{ width: 150 }}>
                {event.snapshot_url && <img src={event.snapshot_url} alt={event.label} style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 6 }} />}
                <small>{event.label} · {(event.confidence * 100).toFixed(0)}%</small>
              </div>)}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
