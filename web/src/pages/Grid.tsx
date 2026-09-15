import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Camera } from '../api';
import HlsPlayer from '../HlsPlayer';

/** Xem đồng thời các luồng live đã chọn. Chỉ mở stream khi người dùng vào trang này. */
export default function Grid() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [err, setErr] = useState('');

  useEffect(() => {
    api.listCameras().then((items) => {
      setCameras(items);
      setSelected(new Set(items.filter((camera) => camera.enabled).slice(0, 4).map((camera) => camera.id)));
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

  const visible = cameras.filter((camera) => selected.has(camera.id));
  return (
    <div>
      <h2>Multi-view</h2>
      <p style={{ color: '#666' }}>Chọn camera cần xem. H.265 sẽ tốn CPU/GPU khi mỗi luồng live được chuyển sang H.264.</p>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '14px 0 20px' }}>
        {cameras.map((camera) => (
          <label key={camera.id} style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
            <input type="checkbox" checked={selected.has(camera.id)} onChange={() => toggle(camera.id)} /> {camera.name}
          </label>
        ))}
      </div>
      {visible.length === 0 && <p style={{ color: '#888' }}>Chưa chọn camera nào.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {visible.map((camera) => (
          <section key={camera.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#111827' }}>
            <HlsPlayer src={`/live/${camera.id}/index.m3u8`} live />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', padding: '8px 10px' }}>
              <span>{camera.name} <small style={{ color: '#9ca3af' }}>({camera.status})</small></span>
              <Link to={`/live/${camera.id}`} style={{ color: '#93c5fd', fontSize: 13 }}>Mở lớn</Link>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
