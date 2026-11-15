import { useState } from 'react';
import api, { errMsg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import { resizeImage } from '../utils.js';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user.name,
    address: user.address || '',
    profession: user.profession || '',
    photo: user.photo || '',
  });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pickPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setForm({ ...form, photo: await resizeImage(file) });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api.put('/users/me', form);
      setUser(r.data);
      setMsg({ type: 'ok', text: 'Profile saved' });
    } catch (e2) {
      setMsg({ type: 'error', text: errMsg(e2) });
    }
  };

  const changePw = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    try {
      await api.put('/auth/password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      setPwMsg({ type: 'ok', text: 'Password changed' });
    } catch (e2) {
      setPwMsg({ type: 'error', text: errMsg(e2) });
    }
  };

  return (
    <>
      <h1>My profile</h1>
      <p className="muted">
        ID: <strong>{user.userId}</strong> · <span className={'pill ' + user.role}>{user.role}</span>
      </p>

      <form className="card" onSubmit={save}>
        <div className="photo-row">
          <Avatar user={form} size={72} />
          <div>
            <input type="file" accept="image/*" onChange={pickPhoto} />
            {form.photo && (
              <button type="button" className="btn small ghost" style={{ marginTop: 6 }} onClick={() => setForm({ ...form, photo: '' })}>
                Remove photo
              </button>
            )}
          </div>
        </div>
        <label>Name</label>
        <input value={form.name} onChange={set('name')} required />
        <label>Address</label>
        <input value={form.address} onChange={set('address')} />
        <label>Profession</label>
        <input value={form.profession} onChange={set('profession')} />
        {msg && <div className={'alert ' + msg.type}>{msg.text}</div>}
        <div className="actions"><button className="btn">Save profile</button></div>
      </form>

      <form className="card" onSubmit={changePw}>
        <h2>Change password</h2>
        <label>Current password</label>
        <input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
        <label>New password (min 6 characters)</label>
        <input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} minLength={6} required />
        {pwMsg && <div className={'alert ' + pwMsg.type}>{pwMsg.text}</div>}
        <div className="actions"><button className="btn">Change password</button></div>
      </form>
    </>
  );
}
