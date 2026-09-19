import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Icon from '../Icon';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { token } = await api.login(username, password);
      localStorage.setItem('token', token);
      navigate('/live');
    } catch (error: any) {
      setErr(error.message ?? 'Không thể đăng nhập');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mi-login">
      <section className="mi-login-intro">
        <div className="mi-login-brand"><span><Icon name="camera" size={26} stroke={2.2} /></span>MiHome</div>
        <p>Every corner, closer to home.</p>
        <div className="mi-login-orbit mi-login-orbit-one" /><div className="mi-login-orbit mi-login-orbit-two" />
      </section>
      <section className="mi-login-card">
        <div><span className="eyebrow">Chào mừng trở lại</span><h1>Đăng nhập</h1><p>Quản lý camera và không gian của bạn.</p></div>
        <form onSubmit={submit}>
          <label>Tài khoản<input value={username} onChange={(event) => setUsername(event.target.value)} autoFocus autoComplete="username" /></label>
          <label>Mật khẩu<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
          {err && <p className="mi-login-error">{err}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Đang đăng nhập…' : 'Vào không gian của bạn'} <Icon name="play" size={14} /></button>
        </form>
      </section>
    </main>
  );
}
