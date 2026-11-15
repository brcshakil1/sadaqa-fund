const Payment = require('../models/Payment');
const Donation = require('../models/Donation');

// Wrap async route handlers so errors reach the error middleware (Express 4)
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const httpError = (status, message) => Object.assign(new Error(message), { status });

const isMonth = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

// Builds a filter for the "YYYY-MM" month field from:
//   ?month=YYYY-MM            one exact month
//   ?year=YYYY                a whole year
//   ?monthNum=MM              one calendar month (any year, or combined with year)
//   ?from=YYYY-MM&to=YYYY-MM  a range of months (either end may be left out)
// These can be combined. Returns undefined when no period filter was asked for.
const periodFilter = (q) => {
  const { month, year, monthNum, from, to } = q;
  if (month) {
    if (!isMonth(month)) throw httpError(400, 'Invalid month');
    return month;
  }
  const f = {};
  if (from) {
    if (!isMonth(from)) throw httpError(400, 'Invalid "from" month');
    f.$gte = from;
  }
  if (to) {
    if (!isMonth(to)) throw httpError(400, 'Invalid "to" month');
    f.$lte = to;
  }
  if (from && to && from > to) throw httpError(400, 'The "from" month must not be after the "to" month');
  if (year || monthNum) {
    if (year && !/^\d{4}$/.test(String(year))) throw httpError(400, 'Invalid year');
    if (monthNum && !/^(0[1-9]|1[0-2])$/.test(String(monthNum))) throw httpError(400, 'Invalid month');
    f.$regex = `^${year || '\\d{4}'}-${monthNum || '\\d{2}'}$`;
  }
  return Object.keys(f).length ? f : undefined;
};

const parseAmount = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw httpError(400, 'Enter a valid amount greater than 0');
  if (n > 100000000) throw httpError(400, 'Amount is too large');
  return Math.round(n * 100) / 100;
};

// Only accept small image data-URLs for profile pictures
const cleanPhoto = (p) =>
  typeof p === 'string' && p.startsWith('data:image/') && p.length < 300000 ? p : '';

const sum = async (Model, match) => {
  const r = await Model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return r[0] ? r[0].total : 0;
};

// Fund balance = all approved Sadaqah received - all approved donations given out
const getBalance = async () => {
  const [collected, donated] = await Promise.all([
    sum(Payment, { status: 'approved' }),
    sum(Donation, { status: 'approved' }),
  ]);
  return { collected, donated, balance: collected - donated };
};

module.exports = { wrap, httpError, isMonth, periodFilter, parseAmount, cleanPhoto, sum, getBalance };
