import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { errMsg } from '../api.js';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(userId, password);
      navigate('/');
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-bg">
      <form className="login-card" onSubmit={submit}>
        <img className="login-logo" src="/logo-icon.png" alt="" />
        <div className="login-title">SADAQA <b>FUND</b></div>
        <div className="login-quote">Charity does not decrease wealth.</div>
        <div className="sub">Log in with the ID your admin gave you.</div>

        <label htmlFor="uid">ID</label>
        <input id="uid" value={userId} onChange={(e) => setUserId(e.target.value)} autoCapitalize="none" autoComplete="username" autoFocus required />

        <label htmlFor="pw">Password</label>
        <input id="pw" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, margin: '10px 0 0' }}>
          <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} /> Show password
        </label>

        {err && <div className="alert error">{err}</div>}
        <div className="actions">
          <button className="btn block" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
        </div>
        <div className="login-foot">No account yet? Ask one of the fund admins to create one for you.</div>
      </form>
    </div>
  );
}
