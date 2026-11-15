import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { currentMonth, dateLabel, monthLabel, taka } from '../utils.js';

export default function Donate() {
  const [mine, setMine] = useState([]);
  const [form, setForm] = useState({ amount: '', month: currentMonth(), recipientName: '', recipientAddress: '', reason: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/donations/mine').then((r) => setMine(r.data)).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await api.post('/donations', form);
      setMsg({ type: 'ok', text: 'Request sent. The amount leaves the fund only after an admin approves it.' });
      setForm({ ...form, amount: '', recipientName: '', recipientAddress: '', reason: '' });
      load();
    } catch (e2) {
      setMsg({ type: 'error', text: errMsg(e2) });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this request?')) return;
    try {
      await api.delete(`/donations/${id}`);
      load();
    } catch (e) {
      setMsg({ type: 'error', text: errMsg(e) });
    }
  };

  return (
    <>
      <h1>Donate from the fund</h1>
      <p className="muted">Suggest someone who should receive a donation from the fund.</p>
      <ol className="steps">
        <li><b>Fill in the request</b><span>Who needs help, how much, and why.</span></li>
        <li><b>An admin reviews it</b><span>If you are an admin, the other admin reviews it.</span></li>
        <li><b>The amount leaves the fund</b><span>After approval it is deducted and shown in History.</span></li>
      </ol>

      <form className="card" onSubmit={submit}>
        <div className="row two">
          <div>
            <label>Amount (৳)</label>
            <input type="number" min="1" step="any" value={form.amount} onChange={set('amount')} required />
          </div>
          <div>
            <label>Month</label>
            <input type="month" value={form.month} onChange={set('month')} required />
          </div>
        </div>
        <label>Donate to (name)</label>
        <input value={form.recipientName} onChange={set('recipientName')} required />
        <label>Address</label>
        <input value={form.recipientAddress} onChange={set('recipientAddress')} />
        <label>Reason</label>
        <textarea value={form.reason} onChange={set('reason')} placeholder="Why does this person need help?" />
        {msg && <div className={'alert ' + msg.type}>{msg.text}</div>}
        <div className="actions">
          <button className="btn" disabled={busy}>{busy ? 'Sending...' : 'Submit request'}</button>
        </div>
      </form>

      <div className="card">
        <h2>My donation requests</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Month</th><th>To</th><th>Reason</th><th className="num">Amount</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {mine.map((d) => (
                <tr key={d._id}>
                  <td>{dateLabel(d.createdAt)}</td>
                  <td>{monthLabel(d.month)}</td>
                  <td>
                    {d.recipientName}
                    {d.recipientAddress && <div className="note-text">{d.recipientAddress}</div>}
                  </td>
                  <td>{d.reason || '-'}</td>
                  <td className="num">{taka(d.amount)}</td>
                  <td>
                    <span className={'pill ' + d.status}>{d.status}</span>
                    {d.reviewNote && <div className="note-text">{d.reviewNote}</div>}
                  </td>
                  <td>
                    {d.status === 'pending' && (
                      <button type="button" className="btn small ghost" onClick={() => cancel(d._id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
              {!mine.length && <tr><td colSpan="7" className="empty">No requests yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
