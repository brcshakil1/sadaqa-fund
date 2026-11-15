import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { currentMonth, dateLabel, monthLabel, taka } from '../utils.js';

export default function SubmitSadaqah() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [mine, setMine] = useState([]);
  const [form, setForm] = useState({ amount: '', month: currentMonth(), toAdmin: '', type: 'monthly', note: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api.get('/payments/mine').then((r) => setMine(r.data)).catch(() => {});

  useEffect(() => {
    api
      .get('/users')
      .then((r) => setAdmins(r.data.filter((u) => u.role === 'admin' && u.active && u._id !== user._id)))
      .catch((e) => setMsg({ type: 'error', text: errMsg(e) }));
    load();
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await api.post('/payments', form);
      setMsg({ type: 'ok', text: 'Sent! The admin has been notified and will confirm once they receive it.' });
      setForm({ ...form, amount: '', note: '' });
      load();
    } catch (e2) {
      setMsg({ type: 'error', text: errMsg(e2) });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this submission?')) return;
    try {
      await api.delete(`/payments/${id}`);
      load();
    } catch (e) {
      setMsg({ type: 'error', text: errMsg(e) });
    }
  };

  return (
    <>
      <h1>Send Sadaqah</h1>
      <p className="muted">Tell the fund about the Sadaqah you sent.</p>
      <ol className="steps">
        <li><b>Send the money</b><span>Give or transfer it to one of the admins.</span></li>
        <li><b>Fill in this form</b><span>Amount, month, and which admin received it.</span></li>
        <li><b>The admin confirms</b><span>Once confirmed, it is added to the fund.</span></li>
      </ol>

      <form className="card" onSubmit={submit}>
        <div className="row two">
          <div>
            <label>Amount (৳)</label>
            <input type="number" min="1" step="any" value={form.amount} onChange={set('amount')} required />
          </div>
          <div>
            <label>For which month</label>
            <input type="month" value={form.month} onChange={set('month')} required />
          </div>
        </div>

        <label>Sent to which admin</label>
        <select value={form.toAdmin} onChange={set('toAdmin')} required>
          <option value="">Choose an admin...</option>
          {admins.map((a) => (
            <option key={a._id} value={a._id}>{a.name} ({a.userId})</option>
          ))}
        </select>

        <label>What is it for</label>
        <div className="radio-row">
          <label>
            <input type="radio" name="type" checked={form.type === 'monthly'} onChange={() => setForm({ ...form, type: 'monthly' })} />
            Monthly Sadaqah
          </label>
          <label>
            <input type="radio" name="type" checked={form.type === 'extra'} onChange={() => setForm({ ...form, type: 'extra' })} />
            Extra / other donation
          </label>
        </div>

        <label>Note (optional)</label>
        <textarea value={form.note} onChange={set('note')} placeholder="e.g. sent by bKash, reason for extra..." />

        {msg && <div className={'alert ' + msg.type}>{msg.text}</div>}
        <div className="actions">
          <button className="btn" disabled={busy}>{busy ? 'Sending...' : 'Submit'}</button>
        </div>
      </form>

      <div className="card">
        <h2>My submissions</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Month</th><th>Type</th><th>To</th><th className="num">Amount</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {mine.map((p) => (
                <tr key={p._id}>
                  <td>{dateLabel(p.createdAt)}</td>
                  <td>{monthLabel(p.month)}</td>
                  <td>{p.type === 'monthly' ? 'Monthly' : 'Extra'}</td>
                  <td>{p.toAdmin ? p.toAdmin.name : '-'}</td>
                  <td className="num">{taka(p.amount)}</td>
                  <td>
                    <span className={'pill ' + p.status}>{p.status}</span>
                    {p.reviewNote && <div className="note-text">{p.reviewNote}</div>}
                  </td>
                  <td>
                    {p.status === 'pending' && (
                      <button type="button" className="btn small ghost" onClick={() => cancel(p._id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
              {!mine.length && <tr><td colSpan="7" className="empty">Nothing submitted yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
