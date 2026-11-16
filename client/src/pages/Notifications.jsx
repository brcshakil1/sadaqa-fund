import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { dateLabel } from '../utils.js';

const PAGE = 5; // show 5 at first, then 5 more each time "See more" is clicked

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [shown, setShown] = useState(PAGE); // how many notifications are visible
  const [err, setErr] = useState('');

  const load = () =>
    api
      .get('/notifications')
      .then((r) => setItems(r.data))
      .catch((e) => setErr(errMsg(e)));

  useEffect(() => {
    load();
  }, []);

  const open = async (n) => {
    if (!n.read) {
      await api.patch(`/notifications/${n._id}/read`).catch(() => {});
      window.dispatchEvent(new Event('notifs-changed'));
    }
    // Members have no approvals page
    if (n.link === '/approvals' && user.role !== 'admin') return load();
    if (n.link) navigate(n.link);
    else load();
  };

  const readAll = async () => {
    await api.patch('/notifications/read-all').catch(() => {});
    window.dispatchEvent(new Event('notifs-changed'));
    load();
  };

  return (
    <>
      <div className="toolbar">
        <h1>Notifications</h1>
        {items.some((n) => !n.read) && <button className="btn small ghost" onClick={readAll}>Mark all as read</button>}
      </div>
      {err && <div className="alert error">{err}</div>}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {items.slice(0, shown).map((n) => (
          <div key={n._id} className={'notif' + (n.read ? '' : ' unread')} onClick={() => open(n)}>
            {n.message}
            <small>{dateLabel(n.createdAt)}</small>
          </div>
        ))}
        {!items.length && <div className="empty">No notifications</div>}
      </div>
      {items.length > PAGE && (
        <div className="more-row">
          <span className="note-text">Showing {Math.min(shown, items.length)} of {items.length}</span>
          {shown < items.length && (
            <button className="btn ghost" onClick={() => setShown((s) => s + PAGE)}>
              See more
            </button>
          )}
        </div>
      )}
    </>
  );
}
