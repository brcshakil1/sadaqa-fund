import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SubmitSadaqah from './pages/SubmitSadaqah.jsx';
import Donate from './pages/Donate.jsx';
import History from './pages/History.jsx';
import Profile from './pages/Profile.jsx';
import Notifications from './pages/Notifications.jsx';
import Approvals from './pages/Approvals.jsx';
import ManageMembers from './pages/ManageMembers.jsx';

function Protected({ admin, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/send" element={<Protected><SubmitSadaqah /></Protected>} />
      <Route path="/donate" element={<Protected><Donate /></Protected>} />
      <Route path="/history" element={<Protected><History /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
      <Route path="/approvals" element={<Protected admin><Approvals /></Protected>} />
      <Route path="/manage" element={<Protected admin><ManageMembers /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
