const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { wrap, httpError } = require('../utils/helpers');

const auth = wrap(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw httpError(401, 'Please log in');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, 'Session expired, please log in again');
  }

  const user = await User.findById(payload.id);
  if (!user || !user.active) throw httpError(401, 'Account not available');
  req.user = user;
  next();
});

const adminOnly = (req, res, next) =>
  req.user && req.user.role === 'admin' ? next() : next(httpError(403, 'Admins only'));

module.exports = { auth, adminOnly };
