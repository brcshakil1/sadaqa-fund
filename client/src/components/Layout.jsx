import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import api from '../api.js';
import Avatar from './Avatar.jsx';

// On phones, tables turn into cards. Each cell needs its column heading as a label,
// so we copy the <th> text onto every <td> (and keep doing it as pages load new rows).
function useCardTables(ref, deps) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const apply = () => {
      root.querySelectorAll('table').forEach((table) => {
        const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
        table.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => {
          let col = 0;
          [...tr.children].forEach((td) => {
            const label = td.colSpan > 1 ? '' : heads[col] || '';
            if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label);
            col += td.colSpan || 1;
          });
        });
      });
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef(null);
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState(0); // admin only: things waiting for their decision
  const [moreOpen, setMoreOpen] = useState(false);

  useCardTables(mainRef, [location.pathname]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const u = await api.get('/notifications/unread-count');
        if (alive) setUnread(u.data.count);
        if (user.role === 'admin') {
          const [a, b] = await Promise.all([api.get('/payments/pending'), api.get('/donations/pending')]);
          if (alive) setPending(a.data.length + b.data.length);
        }
      } catch {
        /* ignore: the next poll will try again */
      }
    };
    load();
    const t = setInterval(load, 30000);
    window.addEventListener('notifs-changed', load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener('notifs-changed', load);
    };
  }, [user.role]);

  const isAdmin = user.role === 'admin';
  const links = [
    { to: '/', label: 'Home', icon: '🏠' },
    { to: '/send', label: 'Send Sadaqah', short: 'Send', icon: '💚' },
    { to: '/donate', label: 'Donate', icon: '🤲' },
    { to: '/history', label: 'History', icon: '📜' },
    ...(isAdmin
      ? [
          { to: '/approvals', label: 'Approvals', icon: '✅', badge: pending },
          { to: '/manage', label: 'Members', icon: '👥' },
        ]
      : []),
    { to: '/profile', label: 'Profile', icon: '👤' },
  ];
  const bottomKeys = isAdmin ? ['/', '/send', '/approvals', '/history'] : ['/', '/send', '/donate', '/history'];
  const bottom = bottomKeys.map((k) => links.find((l) => l.to === k));
  const more = links.filter((l) => !bottomKeys.includes(l.to));

  const doLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <img src="/logo-icon.png" alt="" />
            <div className="wordmark">
              SADAQA <b>FUND</b>
              <small>Charity does not decrease wealth.</small>
            </div>
          </Link>

          <nav className="nav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
                {l.badge > 0 && <span className="count">{l.badge}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="header-right">
            <Link to="/notifications" className="icon-btn" title="Notifications" aria-label="Notifications">
              🔔{unread > 0 && <span className="badge">{unread}</span>}
            </Link>
            <Link to="/profile" className="hide-mobile" title="My profile" style={{ textDecoration: 'none' }}>
              <Avatar user={user} size={38} />
            </Link>
            <button className="btn ghost small hide-mobile" onClick={doLogout}>Log out</button>
          </div>
        </div>
      </header>

      <main className="page" ref={mainRef}>
        {children}
      </main>

      <nav className="bottom-nav" aria-label="Main">
        {bottom.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">
              {l.icon}
              {l.badge > 0 && <i className="count">{l.badge}</i>}
            </span>
            {l.short || l.label}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)} aria-label="More">
          <span className="ico">☰</span>
          More
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="sheet" role="dialog" aria-label="More">
            <div className="sheet-handle" />
            <div className="sheet-user">
              <Avatar user={user} size={46} />
              <div>
                <strong>{user.name}</strong>
                <div className="muted">{user.userId} · {user.role}</div>
              </div>
            </div>
            {more.map((l) => (
              <Link key={l.to} to={l.to} className="sheet-link">
                <span className="ico">{l.icon}</span>
                {l.label}
              </Link>
            ))}
            <Link to="/notifications" className="sheet-link">
              <span className="ico">🔔</span>
              Notifications{unread > 0 ? ` (${unread})` : ''}
            </Link>
            <button className="sheet-link danger" onClick={doLogout}>
              <span className="ico">🚪</span>
              Log out
            </button>
          </div>
        </>
      )}
    </>
  );
}
