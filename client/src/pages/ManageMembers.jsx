import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import { resizeImage } from '../utils.js';

const empty = { userId: '', name: '', password: '', role: 'member', address: '', profession: '', photo: '', active: true };

export default function ManageMembers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null); // user _id or null (= creating)
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get('/users')
      .then((r) => setUsers(r.data))
      .catch((e) => setMsg({ type: 'error', text: errMsg(e) }));

  useEffect(() => {
    load();
  }, []);

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

  const startEdit = (u) => {
    setEditing(u._id);
    setForm({ ...empty, ...u, password: '' });
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    setEditing(null);
    setForm(empty);
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (editing) {
        const body = { ...form };
        if (!body.password) delete body.password;
        await api.put(`/users/${editing}`, body);
        setMsg({ type: 'ok', text: 'Account updated' });
      } else {
        await api.post('/users', form);
        setMsg({ type: 'ok', text: `Account created. Give "${form.userId}" and the password to ${form.name}.` });
      }
      reset();
      load();
    } catch (e2) {
      setMsg({ type: 'error', text: errMsg(e2) });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u) => {
    const action = u.active ? 'disable' : 'enable';
    if (!window.confirm(`${action[0].toUpperCase() + action.slice(1)} ${u.name}'s account?`)) return;
    try {
      await api.put(`/users/${u._id}`, { active: !u.active });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: errMsg(e) });
    }
  };

  return (
    <>
      <h1>Members</h1>
      <p className="muted">Create and manage accounts. Admins can also be added here.</p>

      <form className="card" onSubmit={submit}>
        <h2>{editing ? 'Edit account' : 'Add a new account'}</h2>
        <div className="photo-row">
          <Avatar user={form} size={64} />
          <input type="file" accept="image/*" onChange={pickPhoto} />
        </div>
        <div className="row two">
          <div>
            <label>Login ID</label>
            <input value={form.userId} onChange={set('userId')} disabled={!!editing} autoCapitalize="none" required />
          </div>
          <div>
            <label>{editing ? 'New password (leave empty to keep)' : 'Password (min 6)'}</label>
            <input type="text" value={form.password} onChange={set('password')} minLength={form.password ? 6 : undefined} required={!editing} />
          </div>
          <div>
            <label>Full name</label>
            <input value={form.name} onChange={set('name')} required />
          </div>
          <div>
            <label>Role</label>
            <select value={form.role} onChange={set('role')}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label>Address</label>
            <input value={form.address} onChange={set('address')} />
          </div>
          <div>
            <label>Profession</label>
            <input value={form.profession} onChange={set('profession')} />
          </div>
        </div>
        {msg && <div className={'alert ' + msg.type}>{msg.text}</div>}
        <div className="actions">
          <button className="btn" disabled={busy}>{editing ? 'Save changes' : 'Create account'}</button>
          {editing && <button type="button" className="btn ghost" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th><th>ID</th><th>Role</th><th>Address</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="person">
                      <Avatar user={u} size={34} />
                      <div>
                        <div>{u.name}</div>
                        <div className="muted">{u.profession}</div>
                      </div>
                    </div>
                  </td>
                  <td>{u.userId}</td>
                  <td><span className={'pill ' + u.role}>{u.role}</span></td>
                  <td>{u.address || '-'}</td>
                  <td><span className={'pill ' + (u.active ? 'paid' : 'unpaid')}>{u.active ? 'Active' : 'Disabled'}</span></td>
                  <td>
                    <div className="actions" style={{ margin: 0 }}>
                      <button className="btn small ghost" onClick={() => startEdit(u)}>Edit</button>
                      {u._id !== user._id && (
                        <button className="btn small ghost" onClick={() => toggleActive(u)}>{u.active ? 'Disable' : 'Enable'}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
