import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import { downloadHistoryPdf, tk } from '../pdf.js';
import { dateLabel, downloadCSV, monthLabel, taka } from '../utils.js';

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: thisYear - 2019 }, (_, i) => String(thisYear - i)); // newest first

const typeText = (t) => (t === 'monthly' ? 'Monthly' : 'Extra');
const pill = (cls, text) => <span className={'pill ' + cls}>{text}</span>;

export default function History() {
  const { user } = useAuth();
  const [tab, setTab] = useState('collected');

  // Period: all time, one year, or a range of months (From - To)
  const [mode, setMode] = useState('all');
  const [year, setYear] = useState(String(thisYear));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [memberId, setMemberId] = useState('');
  const [type, setType] = useState('');

  const [people, setPeople] = useState([]);
  const [payments, setPayments] = useState([]);
  const [donations, setDonations] = useState([]);
  const [minePay, setMinePay] = useState([]);
  const [mineDon, setMineDon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const rangeBad = mode === 'range' && from && to && from > to;

  // people list (for the member filter) + my own activity: loaded once
  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/payments/mine'), api.get('/donations/mine')])
      .then(([u, p, d]) => {
        setPeople(u.data);
        setMinePay(p.data);
        setMineDon(d.data);
      })
      .catch((e) => setErr(errMsg(e)));
  }, []);

  // everyone's confirmed records: reloaded whenever a filter changes
  useEffect(() => {
    if (rangeBad) {
      setPayments([]);
      setDonations([]);
      setLoading(false);
      setErr('The "From" month must come before the "To" month.');
      return undefined;
    }
    let alive = true;
    setErr('');
    setLoading(true);
    const base = {};
    if (mode === 'year') base.year = year;
    if (mode === 'range') {
      if (from) base.from = from;
      if (to) base.to = to;
    }
    if (memberId) base.member = memberId;
    Promise.all([
      api.get('/payments', { params: { ...base, ...(type ? { type } : {}) } }),
      api.get('/donations', { params: base }),
    ])
      .then(([a, b]) => {
        if (!alive) return;
        setPayments(a.data);
        setDonations(b.data);
      })
      .catch((e) => alive && setErr(errMsg(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [mode, year, from, to, memberId, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setMode('all');
    setYear(String(thisYear));
    setFrom('');
    setTo('');
    setMemberId('');
    setType('');
  };

  const inPeriod = (m) => {
    if (mode === 'year') return m.startsWith(year + '-');
    if (mode === 'range') return (!from || m >= from) && (!to || m <= to);
    return true;
  };

  // ----- what the current tab shows (also what gets downloaded) -----
  let view;
  if (tab === 'collected') {
    view = {
      title: 'Sadaqah received',
      slug: 'received',
      head: ['Month', 'Member', 'Type', 'To admin', 'Amount'],
      amountIdx: 4,
      empty: 'No confirmed Sadaqah for these filters',
      rows: payments.map((p) => ({
        key: p._id,
        raw: [monthLabel(p.month), p.member ? p.member.name : '-', typeText(p.type), p.toAdmin ? p.toAdmin.name : '-', p.amount],
        cells: [monthLabel(p.month), p.member ? p.member.name : '-', pill(p.type, typeText(p.type)), p.toAdmin ? p.toAdmin.name : '-', taka(p.amount)],
      })),
      total: payments.reduce((s, p) => s + p.amount, 0),
    };
  } else if (tab === 'given') {
    view = {
      title: 'Donations given',
      slug: 'donations',
      head: ['Month', 'Given to', 'Address', 'Reason', 'Requested by', 'Amount'],
      amountIdx: 5,
      empty: 'No donations given for these filters',
      rows: donations.map((d) => ({
        key: d._id,
        raw: [monthLabel(d.month), d.recipientName, d.recipientAddress || '-', d.reason || '-', d.requestedBy ? d.requestedBy.name : '-', d.amount],
        cells: [monthLabel(d.month), d.recipientName, d.recipientAddress || '-', d.reason || '-', d.requestedBy ? d.requestedBy.name : '-', taka(d.amount)],
      })),
      total: donations.reduce((s, d) => s + d.amount, 0),
    };
  } else {
    const merged = [
      ...minePay.filter((p) => inPeriod(p.month)).map((p) => ({
        id: p._id, date: p.createdAt, what: `Sadaqah (${typeText(p.type)}) to ${p.toAdmin ? p.toAdmin.name : '-'}`, month: p.month, amount: p.amount, status: p.status,
      })),
      ...mineDon.filter((d) => inPeriod(d.month)).map((d) => ({
        id: d._id, date: d.createdAt, what: `Donation request: ${d.recipientName}`, month: d.month, amount: d.amount, status: d.status,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    view = {
      title: 'My activity',
      slug: 'my-activity',
      head: ['Date', 'What', 'Month', 'Amount', 'Status'],
      amountIdx: 3,
      empty: 'Nothing here for these filters',
      rows: merged.map((r) => ({
        key: r.id,
        raw: [dateLabel(r.date), r.what, monthLabel(r.month), r.amount, r.status],
        cells: [dateLabel(r.date), r.what, monthLabel(r.month), taka(r.amount), pill(r.status, r.status)],
      })),
      total: null,
    };
  }

  // ----- text describing the filters (used in the PDF and in file names) -----
  const memberName = (people.find((p) => p._id === memberId) || {}).name;
  let periodText = 'All time';
  let periodSlug = 'all-time';
  if (mode === 'year') {
    periodText = `Year ${year}`;
    periodSlug = year;
  } else if (mode === 'range') {
    periodText = `${from ? monthLabel(from) : 'The beginning'} to ${to ? monthLabel(to) : 'now'}`;
    periodSlug = `${from || 'start'}-to-${to || 'now'}`;
  }
  const filterParts = [
    `Period: ${periodText}`,
    ...(tab !== 'mine' ? [`Member: ${memberName || 'All members'}`] : []),
    ...(tab === 'collected' ? [`Type: ${type ? typeText(type) : 'Monthly + Extra'}`] : []),
  ];
  const fileBase = ['sadaqa', view.slug, periodSlug, memberName && tab !== 'mine' ? memberName.replace(/\s+/g, '-').toLowerCase() : '']
    .filter(Boolean)
    .join('-');

  // When no single member is chosen, the Sadaqah PDF also lists each member's total
  const extraTables = [];
  if (tab === 'collected' && !memberId && payments.length) {
    const byMember = {};
    payments.forEach((p) => {
      const n = p.member ? p.member.name : '-';
      byMember[n] = (byMember[n] || 0) + p.amount;
    });
    extraTables.push({
      title: 'Total by member',
      head: ['Member', 'Total Sadaqah'],
      body: Object.entries(byMember)
        .sort((a, b) => b[1] - a[1])
        .map(([n, t]) => [n, tk(t)]),
    });
  }

  const pdf = () =>
    downloadHistoryPdf({
      title: view.title,
      filterText: filterParts.join('   |   '),
      head: view.head,
      body: view.rows.map((r) => r.raw.map((c, i) => (i === view.amountIdx ? tk(c) : c))),
      total: view.total,
      extraTables,
      filename: `${fileBase}.pdf`,
    }).catch((e) => setErr(errMsg(e)));
  const csv = () => downloadCSV(`${fileBase}.csv`, view.head, view.rows.map((r) => r.raw));

  const filtersActive = mode !== 'all' || memberId || type;
  const monthlySum = payments.filter((p) => p.type === 'monthly').reduce((s, p) => s + p.amount, 0);
  const extraSum = payments.filter((p) => p.type === 'extra').reduce((s, p) => s + p.amount, 0);
  const others = people.filter((p) => p._id !== user._id);

  return (
    <>
      <div className="page-head">
        <h1>History</h1>
        <p className="muted">Everyone's confirmed Sadaqah and donations. Choose the filters you need, then download the report.</p>
      </div>

      <div className="tabs">
        {[
          ['collected', 'Sadaqah received'],
          ['given', 'Donations given'],
          ['mine', 'My activity'],
        ].map(([k, label]) => (
          <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      <div className="card">
        <div className="filters">
          <div>
            <label htmlFor="f-period">Period</label>
            <select id="f-period" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="all">All time</option>
              <option value="year">One year</option>
              <option value="range">From month - To month</option>
            </select>
          </div>

          {mode === 'year' && (
            <div>
              <label htmlFor="f-year">Year</label>
              <select id="f-year" value={year} onChange={(e) => setYear(e.target.value)}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {mode === 'range' && (
            <>
              <div>
                <label htmlFor="f-from">From month</label>
                <input id="f-from" type="month" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label htmlFor="f-to">To month</label>
                <input id="f-to" type="month" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}

          {tab !== 'mine' && (
            <div>
              <label htmlFor="f-member">{tab === 'given' ? 'Requested by' : 'Member'}</label>
              <select id="f-member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">All members</option>
                <option value={user._id}>Me ({user.name})</option>
                {others.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}{p.role === 'admin' ? ' (Admin)' : ''}</option>
                ))}
              </select>
            </div>
          )}

          {tab === 'collected' && (
            <div>
              <label htmlFor="f-type">Type</label>
              <select id="f-type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Monthly + Extra</option>
                <option value="monthly">Monthly Sadaqah</option>
                <option value="extra">Extra / other</option>
              </select>
            </div>
          )}
        </div>

        {mode === 'range' && <div className="note-text" style={{ marginTop: 10 }}>Leave one month empty to include everything before or after the other.</div>}

        <div className="filter-actions">
          {filtersActive ? <button className="btn ghost small" onClick={reset}>Clear filters</button> : <span className="note-text">Showing everything</span>}
          <span className="spacer" />
          <button className="btn small" onClick={pdf} disabled={loading || !view.rows.length}>⬇ Download PDF</button>
          <button className="btn gold small" onClick={csv} disabled={loading || !view.rows.length}>⬇ Download Excel (CSV)</button>
        </div>
      </div>

      {err && <div className="alert error" style={{ marginTop: 0, marginBottom: 14 }}>{err}</div>}

      <div className="summary-strip">
        <span className="chip"><b>{view.rows.length}</b> records</span>
        {view.total !== null && <span className="chip">Total <b>{taka(view.total)}</b></span>}
        {tab === 'collected' && view.rows.length > 0 && (
          <>
            <span className="chip">Monthly <b>{taka(monthlySum)}</b></span>
            <span className="chip">Extra <b>{taka(extraSum)}</b></span>
          </>
        )}
        {tab !== 'mine' && memberId && memberName && (
          <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Avatar user={people.find((p) => p._id === memberId)} size={22} /> {memberName}
          </span>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">Loading...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {view.head.map((h, i) => (
                    <th key={h} className={i === view.amountIdx ? 'num' : ''}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.key}>
                    {r.cells.map((c, i) => (
                      <td key={i} className={i === view.amountIdx ? 'num' : ''}>{c}</td>
                    ))}
                  </tr>
                ))}
                {!view.rows.length && (
                  <tr><td colSpan={view.head.length} className="empty">{view.empty}</td></tr>
                )}
              </tbody>
              {view.rows.length > 0 && view.total !== null && (
                <tfoot>
                  <tr>
                    <td colSpan={view.head.length - 1}>Total</td>
                    <td className="num">{taka(view.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </>
  );
}
