import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import { currentMonth, monthLabel, taka } from '../utils.js';

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [sum, setSum] = useState(null);
  const [members, setMembers] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    setErr('');
    const params = { month };
    Promise.all([api.get('/stats/summary', { params }), api.get('/stats/members', { params })])
      .then(([a, b]) => {
        setSum(a.data);
        setMembers(b.data);
      })
      .catch((e) => setErr(errMsg(e)));
  }, [month]);

  const me = members.find((m) => m._id === user._id);
  const isAdmin = user.role === 'admin';
  const paidCount = members.filter((m) => m.paidMonthly).length;

  return (
    <>
      {err && <div className="alert error" style={{ marginTop: 0, marginBottom: 14 }}>{err}</div>}

      <section className="hero">
        <div className="hero-top">
          <div>
            <small>Assalamu alaikum,</small>
            <h1>{user.name}</h1>
          </div>
          <input
            className="month-input"
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            aria-label="Choose month"
          />
        </div>

        <div className="balance-label">Fund balance now</div>
        <div className="balance">{sum ? taka(sum.balance) : '...'}</div>

        {sum && (
          <div className="hero-stats">
            <div className="hero-stat"><div className="l">Total collected</div><div className="v">{taka(sum.collected)}</div></div>
            <div className="hero-stat"><div className="l">Total donated</div><div className="v">{taka(sum.donated)}</div></div>
            <div className="hero-stat"><div className="l">Collected in {monthLabel(month)}</div><div className="v">{taka(sum.monthCollected)}</div></div>
            <div className="hero-stat"><div className="l">Donated in {monthLabel(month)}</div><div className="v">{taka(sum.monthDonated)}</div></div>
          </div>
        )}
      </section>

      <div className="quick">
        <Link to="/send"><span className="q-ico">💚</span><div><strong>Send Sadaqah</strong><span className="s">Tell an admin you sent it</span></div></Link>
        <Link to="/donate"><span className="q-ico">🤲</span><div><strong>Donate</strong><span className="s">Help someone in need</span></div></Link>
        <Link to="/history"><span className="q-ico">📜</span><div><strong>History</strong><span className="s">See & download records</span></div></Link>
        {isAdmin ? (
          <Link to="/approvals"><span className="q-ico">✅</span><div><strong>Approvals</strong><span className="s">Confirm pending items</span></div></Link>
        ) : (
          <Link to="/profile"><span className="q-ico">👤</span><div><strong>My profile</strong><span className="s">Photo and password</span></div></Link>
        )}
      </div>

      {me && (
        <div className="grid">
          <div className="stat gold">
            <div className="label">Your total Sadaqah</div>
            <div className="value">{taka(me.total)}</div>
          </div>
          <div className="stat">
            <div className="label">You gave in {monthLabel(month)}</div>
            <div className="value">{taka(me.monthTotal)}</div>
          </div>
          <div className="stat">
            <div className="label">Your monthly status</div>
            <div className="value" style={{ fontSize: '1.1rem', paddingTop: 6 }}>
              <span className={'pill ' + (me.paidMonthly ? 'paid' : 'unpaid')}>{me.paidMonthly ? 'Paid' : 'Not yet'}</span>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <div>
            <h2>Members in {monthLabel(month)}</h2>
            <div className="muted">{paidCount} of {members.length} have paid their monthly Sadaqah</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Monthly Sadaqah</th>
                <th className="num">This month</th>
                <th className="num">Monthly total</th>
                <th className="num">Extra total</th>
                <th className="num">All time</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m._id} className={m._id === user._id ? 'me' : ''}>
                  <td>
                    <div className="person">
                      <Avatar user={m} size={36} />
                      <div>
                        <div>{m.name}{m._id === user._id && ' (you)'}</div>
                        <div className="muted">{m.role === 'admin' ? 'Admin' : m.profession || m.userId}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={'pill ' + (m.paidMonthly ? 'paid' : 'unpaid')}>{m.paidMonthly ? 'Paid' : 'Not yet'}</span></td>
                  <td className="num">{taka(m.monthTotal)}</td>
                  <td className="num">{taka(m.monthlyTotal)}</td>
                  <td className="num">{taka(m.extraTotal)}</td>
                  <td className="num"><strong>{taka(m.total)}</strong></td>
                </tr>
              ))}
              {!members.length && <tr><td colSpan="6" className="empty">No members yet</td></tr>}
            </tbody>
            {members.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="2">Total</td>
                  <td className="num">{taka(members.reduce((s, m) => s + m.monthTotal, 0))}</td>
                  <td className="num">{taka(members.reduce((s, m) => s + m.monthlyTotal, 0))}</td>
                  <td className="num">{taka(members.reduce((s, m) => s + m.extraTotal, 0))}</td>
                  <td className="num">{taka(members.reduce((s, m) => s + m.total, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {sum && sum.monthly.length > 0 && (
        <div className="card">
          <div className="card-title"><h2>Month by month</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Month</th><th className="num">Collected</th><th className="num">Donated</th><th className="num">Net</th></tr>
              </thead>
              <tbody>
                {sum.monthly.map((r) => (
                  <tr key={r.month}>
                    <td>{monthLabel(r.month)}</td>
                    <td className="num">{taka(r.collected)}</td>
                    <td className="num">{taka(r.donated)}</td>
                    <td className="num">{taka(r.collected - r.donated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
