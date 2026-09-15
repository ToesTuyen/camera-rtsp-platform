import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { token } = await api.login(username, password);
      localStorage.setItem('token', token);
      nav('/');
    } catch (e: any) {
      setErr(e.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h2>Camera Platform — Đăng nhập</h2>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 12 }}>
          <label>Tài khoản</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            autoFocus
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>
        {err && <p style={{ color: 'crimson' }}>{err}</p>}
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 8,
  marginTop: 4,
  boxSizing: 'border-box',
};
const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};
