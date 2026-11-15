export default function Avatar({ user, size = 36 }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (user && user.photo) return <img className="avatar" style={style} src={user.photo} alt={user.name} />;
  const initials = ((user && user.name) || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <span className="avatar" style={style}>
      {initials}
    </span>
  );
}
