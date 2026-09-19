import { useEffect, useState } from 'react';
import { api, Camera, DetectionEvent } from '../api';

export default function Events() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [err, setErr] = useState('');

  async function load() {
    try {
      setErr('');
      setEvents(await api.listEvents({ cameraId: cameraId ? Number(cameraId) : undefined, limit: 100 }));
    } catch (error: any) {
      setErr(error.message);
    }
  }

  useEffect(() => { api.listCameras().then(setCameras).catch((error) => setErr(error.message)); }, []);
  useEffect(() => { load(); }, [cameraId]);

  return (
    <section className="page-card events-page">
      <span className="eyebrow">An ninh thông minh</span><h2>Sự kiện AI</h2>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <label>Camera: <select value={cameraId} onChange={(event) => setCameraId(event.target.value)}>
          <option value="">Tất cả</option>
          {cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
        </select></label>
        <button onClick={load} style={button}>Làm mới</button>
      </div>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
      {events.length === 0 ? <p style={{ color: '#888' }}>Chưa có sự kiện nhận dạng.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
          {events.map((item) => (
            <article key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              {item.snapshot_url && <img src={item.snapshot_url} alt={`${item.label} at ${item.camera_name}`} style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', background: '#111827' }} />}
              <div style={{ padding: 10 }}>
                <strong>{item.label}</strong> · {(item.confidence * 100).toFixed(0)}%<br />
                <span style={{ color: '#4b5563', fontSize: 13 }}>{item.camera_name}</span><br />
                <time style={{ color: '#6b7280', fontSize: 12 }}>{new Date(item.detected_at).toLocaleString()}</time>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

const button: React.CSSProperties = { padding: '7px 11px', border: '0', color: '#fff', background: '#171716', borderRadius: 7, cursor: 'pointer', fontWeight: 700 };
