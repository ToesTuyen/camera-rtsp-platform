import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Cameras from './pages/Cameras';
import Live from './pages/Live';
import Playback from './pages/Playback';
import Grid from './pages/Grid';
import Events from './pages/Events';

function isAuthed() {
  return !!localStorage.getItem('token');
}

function Protected({ children }: { children: React.ReactNode }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  function logout() {
    localStorage.removeItem('token');
    nav('/login');
  }
  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <header style={{ background: '#111827', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
          📹 Camera Platform
        </Link>
        <nav style={{ display: 'flex', gap: 14, marginLeft: 'auto', marginRight: 18 }}>
          <Link to="/" style={navLink}>Camera</Link>
          <Link to="/grid" style={navLink}>Multi-view</Link>
          <Link to="/events" style={navLink}>Sự kiện AI</Link>
        </nav>
        <button onClick={logout} style={{ background: 'transparent', color: '#fff', border: '1px solid #fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
          Đăng xuất
        </button>
      </header>
      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>{children}</main>
    </div>
  );
}

const navLink: React.CSSProperties = { color: '#dbeafe', textDecoration: 'none', fontSize: 14 };

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Cameras /></Protected>} />
        <Route path="/live/:id" element={<Protected><Live /></Protected>} />
        <Route path="/playback/:id" element={<Protected><Playback /></Protected>} />
        <Route path="/grid" element={<Protected><Grid /></Protected>} />
        <Route path="/events" element={<Protected><Events /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
