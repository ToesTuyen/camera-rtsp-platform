import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Camera, OnvifProbeResult } from '../api';

type CameraForm = {
  name: string;
  rtsp_url: string;
  record: boolean;
  enabled: boolean;
  codec: 'auto' | 'h264' | 'h265';
  ai_enabled: boolean;
  ai_rtsp_url: string;
  ai_fps: number;
  ai_confidence: number;
  ai_labels: string;
  onvif_url: string;
  onvif_username: string;
  onvif_password: string;
};

function emptyForm(): CameraForm {
  return {
    name: '', rtsp_url: '', record: true, enabled: true, codec: 'auto',
    ai_enabled: false, ai_rtsp_url: '', ai_fps: 2, ai_confidence: 0.5,
    ai_labels: 'person, car, motorcycle',
    onvif_url: '', onvif_username: '', onvif_password: '',
  };
}

export default function Cameras() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Camera | null>(null);
  const [form, setForm] = useState<CameraForm>(emptyForm());
  const [onvifResult, setOnvifResult] = useState<OnvifProbeResult | null>(null);
  const [probingOnvif, setProbingOnvif] = useState(false);

  async function load() {
    try {
      setCameras(await api.listCameras());
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // refresh status
    return () => clearInterval(t);
  }, []);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOnvifResult(null);
    setShowForm(true);
  }

  function openEdit(c: Camera) {
    setEditing(c);
    setForm({
      name: c.name,
      rtsp_url: c.rtsp_url,
      record: c.record,
      enabled: c.enabled,
      codec: c.codec ?? 'auto',
      ai_enabled: c.ai_enabled ?? false,
      ai_rtsp_url: c.ai_rtsp_url ?? '',
      ai_fps: c.ai_fps ?? 2,
      ai_confidence: c.ai_confidence ?? 0.5,
      ai_labels: c.ai_labels?.join(', ') ?? 'person, car, motorcycle',
      onvif_url: '', onvif_username: '', onvif_password: '',
    });
    setOnvifResult(null);
    setShowForm(true);
  }

  async function probeOnvif() {
    try {
      setErr('');
      setProbingOnvif(true);
      const result = await api.probeOnvif({
        url: form.onvif_url,
        username: form.onvif_username,
        password: form.onvif_password,
      });
      const main = addRtspCredentials(result.suggested_main_uri, form.onvif_username, form.onvif_password);
      const sub = result.suggested_sub_uri
        ? addRtspCredentials(result.suggested_sub_uri, form.onvif_username, form.onvif_password)
        : '';
      setOnvifResult(result);
      setForm({
        ...form,
        rtsp_url: main,
        ai_rtsp_url: sub || form.ai_rtsp_url,
        codec: result.profiles[0]?.codec === 'h265' ? 'h265' : 'auto',
      });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setProbingOnvif(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = {
        name: form.name,
        rtsp_url: form.rtsp_url,
        record: form.record,
        enabled: form.enabled,
        codec: form.codec,
        ai_enabled: form.ai_enabled,
        ai_rtsp_url: form.ai_rtsp_url,
        ai_fps: form.ai_fps,
        ai_confidence: form.ai_confidence,
        ai_labels: form.ai_labels.split(',').map((label) => label.trim()).filter(Boolean),
      };
      if (editing) {
        await api.updateCamera(editing.id, data);
      } else {
        await api.createCamera(data);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function remove(c: Camera) {
    if (!confirm(`Xóa camera "${c.name}"?`)) return;
    await api.deleteCamera(c.id);
    load();
  }

  return (
    <section className="page-card cameras-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Cameras</h2>
        <button onClick={openAdd} style={primaryBtn}>+ Thêm camera</button>
      </div>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={th}>ID</th>
            <th style={th}>Tên</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Codec</th>
            <th style={th}>Record</th>
            <th style={th}>AI</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {cameras.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={td}>{c.id}</td>
              <td style={td}>{c.name}</td>
              <td style={td}><StatusBadge status={c.status} /></td>
              <td style={td}>{(c.codec ?? 'auto').toUpperCase()}</td>
              <td style={td}>{c.record ? '✓' : '—'}</td>
              <td style={td}>{c.ai_enabled ? `${c.ai_fps ?? 2} FPS` : '—'}</td>
              <td style={td}>
                <Link to={`/live?camera=${c.id}`} style={link}>Live</Link>
                <Link to={`/playback/${c.id}`} style={link}>Playback</Link>
                <button onClick={() => openEdit(c)} style={smallBtn}>Sửa</button>
                <button onClick={() => remove(c)} style={dangerBtn}>Xóa</button>
              </td>
            </tr>
          ))}
          {cameras.length === 0 && (
            <tr><td colSpan={7} style={{ ...td, color: '#888' }}>Chưa có camera nào.</td></tr>
          )}
        </tbody>
      </table>

      {showForm && (
        <div style={overlay} onClick={() => setShowForm(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? 'Sửa camera' : 'Thêm camera'}</h3>
            <form onSubmit={save}>
              <label>Tên</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} />
              <label>RTSP URL</label>
              <input
                value={form.rtsp_url}
                onChange={(e) => setForm({ ...form, rtsp_url: e.target.value })}
                placeholder="rtsp://user:pass@ip:554/..."
                style={input}
              />
              <fieldset style={{ marginTop: 4, border: '1px solid #d1d5db', borderRadius: 6 }}>
                <legend style={{ color: '#374151' }}>Dò ONVIF (tùy chọn)</legend>
                <label>ONVIF device service URL</label>
                <input
                  value={form.onvif_url}
                  onChange={(e) => setForm({ ...form, onvif_url: e.target.value })}
                  placeholder="http://192.168.0.104/onvif/device_service"
                  style={input}
                />
                <label>Tài khoản ONVIF</label>
                <input value={form.onvif_username} onChange={(e) => setForm({ ...form, onvif_username: e.target.value })} style={input} />
                <label>Mật khẩu ONVIF</label>
                <input type="password" value={form.onvif_password} onChange={(e) => setForm({ ...form, onvif_password: e.target.value })} style={input} />
                <button type="button" onClick={probeOnvif} disabled={probingOnvif} style={smallBtn}>
                  {probingOnvif ? 'Đang dò...' : 'Dò profile ONVIF'}
                </button>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 0' }}>
                  Kết quả tự điền main/sub RTSP. Tài khoản ONVIF chỉ dùng cho lần dò này, không lưu riêng trong database.
                </p>
                {onvifResult && <p style={{ fontSize: 12, color: '#166534', margin: '8px 0 0' }}>
                  Đã dò {onvifResult.profiles.length} profile{onvifResult.device.model ? ` · ${onvifResult.device.model}` : ''}.
                </p>}
              </fieldset>
              <label>Codec</label>
              <select
                value={form.codec}
                onChange={(e) => setForm({ ...form, codec: e.target.value as 'auto' | 'h264' | 'h265' })}
                style={input}
              >
                <option value="auto">Auto (tự phát hiện)</option>
                <option value="h264">H.264</option>
                <option value="h265">H.265 / HEVC (transcode để xem live)</option>
              </select>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>
                H.265 sẽ được transcode sang H.264 cho luồng live (tốn CPU hơn). Recording vẫn giữ codec gốc.
              </p>
              <label style={{ display: 'block', marginTop: 8 }}>
                <input type="checkbox" checked={form.record} onChange={(e) => setForm({ ...form, record: e.target.checked })} /> Ghi hình (record)
              </label>
              <label style={{ display: 'block' }}>
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Bật (enabled)
              </label>
              <fieldset style={{ marginTop: 14, border: '1px solid #d1d5db', borderRadius: 6 }}>
                <legend style={{ color: '#374151' }}>Nhận dạng AI</legend>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  <input type="checkbox" checked={form.ai_enabled} onChange={(e) => setForm({ ...form, ai_enabled: e.target.checked })} /> Bật nhận dạng cho camera này
                </label>
                {form.ai_enabled && <>
                  <label>RTSP sub-stream (khuyến nghị)</label>
                  <input
                    value={form.ai_rtsp_url}
                    onChange={(e) => setForm({ ...form, ai_rtsp_url: e.target.value })}
                    placeholder="rtsp://.../substream (bỏ trống để dùng HLS live)"
                    style={input}
                  />
                  <p style={{ fontSize: 12, color: '#888', margin: '-2px 0 8px' }}>
                    Dùng sub-stream 640p ở 1–5 FPS để giảm tải. Không nhập thì AI đọc live HLS, phù hợp để thử nghiệm.
                  </p>
                  <label>FPS AI</label>
                  <input type="number" min="0.1" max="10" step="0.1" value={form.ai_fps} onChange={(e) => setForm({ ...form, ai_fps: Number(e.target.value) })} style={input} />
                  <label>Ngưỡng tin cậy (0–1)</label>
                  <input type="number" min="0" max="1" step="0.05" value={form.ai_confidence} onChange={(e) => setForm({ ...form, ai_confidence: Number(e.target.value) })} style={input} />
                  <label>Nhãn cần lưu sự kiện</label>
                  <input value={form.ai_labels} onChange={(e) => setForm({ ...form, ai_labels: e.target.value })} placeholder="person, car, motorcycle" style={input} />
                </>}
              </fieldset>
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <button type="button" onClick={() => setShowForm(false)} style={smallBtn}>Hủy</button>
                <button type="submit" style={primaryBtn}>Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: '#16a34a',
    connecting: '#d97706',
    error: '#dc2626',
    stopped: '#6b7280',
  };
  return (
    <span style={{ color: '#fff', background: colors[status] ?? '#6b7280', padding: '2px 8px', borderRadius: 10, fontSize: 12 }}>
      {status}
    </span>
  );
}

const th: React.CSSProperties = { padding: 8 };
const td: React.CSSProperties = { padding: 8 };
const link: React.CSSProperties = { marginRight: 10, color: '#2563eb' };
const input: React.CSSProperties = { width: '100%', padding: 8, marginTop: 4, marginBottom: 8, boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginLeft: 8 };
const smallBtn: React.CSSProperties = { padding: '4px 10px', marginRight: 6, border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', background: '#fff' };
const dangerBtn: React.CSSProperties = { ...smallBtn, color: '#dc2626', borderColor: '#dc2626' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal: React.CSSProperties = { background: '#fff', color: '#111827', padding: 24, borderRadius: 10, width: 420, maxWidth: '90%' };

function addRtspCredentials(uri: string, username: string, password: string): string {
  const url = new URL(uri);
  url.username = username;
  url.password = password;
  return url.toString();
}
