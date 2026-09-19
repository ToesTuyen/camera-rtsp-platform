import { BrowserRouter, Routes, Route, Navigate, Link, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Cameras from './pages/Cameras';
import Playback from './pages/Playback';
import Grid from './pages/Grid';
import Events from './pages/Events';
import Storage from './pages/Storage';
import { api, Camera } from './api';
import Icon from './Icon';

function isAuthed() {
  return !!localStorage.getItem('token');
}

function Protected({ children }: { children: React.ReactNode }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<Camera[]>([]);

  useEffect(() => {
    api.listCameras().then(setCameras).catch(() => setCameras([]));
  }, []);

  function logout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div className="mi-app-shell">
      <aside className="mi-sidebar">
        <Link to="/live" className="mi-brand" aria-label="MiHome Camera">
          <span className="mi-brand-mark"><Icon name="camera" size={20} stroke={2.1} /></span>
          <span>MiHome</span>
        </Link>

        <nav className="mi-nav" aria-label="Điều hướng chính">
          <NavLink to="/live" end><Icon name="monitor" size={19} /><span>Camera</span></NavLink>
          <NavLink to="/playback"><Icon name="clock" size={19} /><span>Playback</span></NavLink>
          <NavLink to="/events"><Icon name="search" size={19} /><span>Hoạt động</span></NavLink>
          <NavLink to="/cameras"><Icon name="settings" size={19} /><span>Thiết bị</span></NavLink>
        </nav>

        <div className="mi-sidebar-divider" />
        <div className="mi-device-heading"><span>CAMERA CỦA BẠN</span><Link to="/cameras" title="Thêm camera">+</Link></div>
        <div className="mi-device-list">
          {cameras.map((camera) => (
            <Link key={camera.id} to={`/live?camera=${camera.id}`} title={`Mở ${camera.name}`}>
              <i className={`status-dot ${camera.status}`} />
              <span>{camera.name}</span>
            </Link>
          ))}
          {cameras.length === 0 && <span className="mi-empty-devices">Chưa có camera</span>}
        </div>

        <button className="mi-account" type="button" onClick={logout} title="Đăng xuất">
          <span className="mi-account-avatar">T</span>
          <span><b>Tuyen</b><small>Quản trị viên</small></span>
          <Icon name="chevronDown" size={16} />
        </button>
      </aside>
      <main className="mi-main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/live" replace />} />
        <Route path="/cameras" element={<Protected><Cameras /></Protected>} />
        <Route path="/live" element={<Protected><Grid /></Protected>} />
        <Route path="/live/:id" element={<Navigate to="/live" replace />} />
        <Route path="/playback" element={<Protected><Storage /></Protected>} />
        <Route path="/playback/:id" element={<Protected><Playback /></Protected>} />
        <Route path="/grid" element={<Navigate to="/live" replace />} />
        <Route path="/events" element={<Protected><Events /></Protected>} />
        <Route path="/storage" element={<Navigate to="/playback" replace />} />
        <Route path="*" element={<Navigate to="/live" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
