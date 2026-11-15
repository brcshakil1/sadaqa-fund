import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { dateLabel, monthLabel, taka } from '../utils.js';

export default function Approvals() {
  const [payments, setPayments] = useState([]);
  const [donations, setDonations] = useState([]);
  const [balance, setBalance] = useState(0);
  const [msg, setMsg] = useState(null);
  const [busyId, setBusyId] = useState('');

  const load = () =>
    Promise.all([api.get('/payments/pending'), api.get('/donations/pending'), api.get('/stats/summary')])
      .then(([a, b, c]) => {
        setPayments(a.data);
        setDonations(b.data);
        setBalance(c.data.balance);
      })
      .catch((e) => setMsg({ type: 'error', text: errMsg(e) }));

  useEffect(() => {
    load();
  }, []);

  const review = async (kind, id, action) => {
    let note = '';
    if (action === 'reject') {
      note = window.prompt('Reason for rejecting (optional):') ;
      if (note === null) return;
    } else if (!window.confirm(kind === 'payments' ? 'Confirm you received this money?' : 'Approve this donation? It will be deducted from the fund.')) {
      return;
    }
    setBusyId(id);
    setMsg(null);
    try {
      await api.patch(`/${kind}/${id}/review`, { action, note });
      setMsg({ type: 'ok', text: action === 'approve' ? 'Approved' : 'Rejected' });
      await load();
      window.dispatchEvent(new Event('notifs-changed')); // refresh the badge in the menu
    } catch (e) {
      setMsg({ type: 'error', text: errMsg(e) });
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <h1>Approvals</h1>
      <p className="muted">Fund balance now: <strong>{taka(balance)}</strong></p>
      {msg && <div className={'alert ' + msg.type}>{msg.text}</div>}

      <div className="card">
        <h2>Sadaqah sent to you ({payments.length})</h2>
        <p className="muted">Confirm only after the money has actually reached you.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Member</th><th>Month</th><th>Type</th><th>Note</th><th className="num">Amount</th><th></th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id}>
                  <td>{dateLabel(p.createdAt)}</td>
                  <td>{p.member ? p.member.name : '-'}</td>
                  <td>{monthLabel(p.month)}</td>
                  <td>{p.type === 'monthly' ? 'Monthly' : 'Extra'}</td>
                  <td>{p.note || '-'}</td>
                  <td className="num"><strong>{taka(p.amount)}</strong></td>
                  <td>
                    <div className="actions" style={{ margin: 0 }}>
                      <button className="btn small" disabled={busyId === p._id} onClick={() => review('payments', p._id, 'approve')}>Confirm</button>
                      <button className="btn small danger" disabled={busyId === p._id} onClick={() => review('payments', p._id, 'reject')}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!payments.length && <tr><td colSpan="7" className="empty">Nothing waiting</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Donation requests ({donations.length})</h2>
        <p className="muted">Requests you made yourself are reviewed by the other admin.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Requested by</th><th>Donate to</th><th>Reason</th><th className="num">Amount</th><th></th></tr></thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d._id}>
                  <td>{dateLabel(d.createdAt)}</td>
                  <td>{d.requestedBy ? d.requestedBy.name : '-'}</td>
                  <td>
                    {d.recipientName}
                    {d.recipientAddress && <div className="note-text">{d.recipientAddress}</div>}
                  </td>
                  <td>{d.reason || '-'}</td>
                  <td className="num"><strong>{taka(d.amount)}</strong></td>
                  <td>
                    <div className="actions" style={{ margin: 0 }}>
                      <button className="btn small" disabled={busyId === d._id} onClick={() => review('donations', d._id, 'approve')}>Approve</button>
                      <button className="btn small danger" disabled={busyId === d._id} onClick={() => review('donations', d._id, 'reject')}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!donations.length && <tr><td colSpan="6" className="empty">Nothing waiting</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
