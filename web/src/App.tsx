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
  const nav = useNavigate();
  const [cameras, setCameras] = useState<Camera[]>([]);

  useEffect(() => {
    api.listCameras().then(setCameras).catch(() => setCameras([]));
  }, []);

  function logout() {
    localStorage.removeItem('token');
    nav('/login');
  }
  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="app-header">
          <Link to="/live" className="brand" aria-label="Camera RTSP Platform">
            <span className="brand-mark"><Icon name="video" size={19} stroke={2.2} /></span>
            Vigilance
          </Link>
          <span className="header-rule" />
          <nav className="top-nav" aria-label="Điều hướng chính">
            <NavLink to="/live" end>Live view</NavLink>
            <NavLink to="/playback">Playback</NavLink>
            <NavLink to="/cameras">Camera</NavLink>
            <NavLink to="/events">Sự kiện AI</NavLink>
          </nav>
          <button className="account-menu" onClick={logout} title="Đăng xuất">
            <span className="account-avatar"><Icon name="user" size={18} /></span>
            <span>Admin</span>
            <Icon name="chevronDown" size={16} />
          </button>
        </header>
        <div className="app-body">
          <aside className="camera-sidebar">
            <div className="sidebar-heading">
              <span>Network Video Recorder</span>
              <button className="round-icon-button" title="Tìm camera"><Icon name="search" size={20} /></button>
            </div>
            <div className="camera-tree">
              <details className="tree-section" open>
                <summary className="tree-summary"><Icon name="monitor" size={20} />Live view <Icon name="chevronDown" size={17} className="tree-chevron" /></summary>
                <div className="tree-items">
                  {cameras.map((camera) => (
                    <Link key={camera.id} to={`/live?camera=${camera.id}`} className="tree-camera" title={`Mở ${camera.name} trong Live view`}>
                      <span className={`status-dot ${camera.status}`} />
                      <Icon name="video" size={18} />
                      <span>{camera.name}</span>
                    </Link>
                  ))}
                  {cameras.length === 0 && <p className="sidebar-empty">Chưa có camera. Thêm camera trong mục <b>Camera</b> để bắt đầu xem live.</p>}
                </div>
              </details>
              <details className="tree-section">
                <summary className="tree-summary"><Icon name="folder" size={20} />Máy chủ <Icon name="chevronDown" size={17} className="tree-chevron" /></summary>
                <div className="tree-items"><Link to="/cameras" className="tree-camera"><Icon name="monitor" size={18} /><span>Camera RTSP Server</span></Link></div>
              </details>
            </div>
          </aside>
          <main className="app-content">{children}</main>
        </div>
      </div>
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
