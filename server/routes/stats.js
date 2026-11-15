const router = require('express').Router();
const Payment = require('../models/Payment');
const Donation = require('../models/Donation');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { wrap, httpError, isMonth, sum, getBalance } = require('../utils/helpers');

router.use(auth);

const checkMonth = (m) => {
  if (m !== undefined && m !== '' && !isMonth(m)) throw httpError(400, 'Invalid month');
  return m || null;
};

// Per-member totals: all-time, selected month, monthly-type vs extra-type
const memberStats = async (month) => {
  const users = await User.find({ active: true }).select('name userId photo role profession').sort({ name: 1 });
  const rows = await Payment.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: { m: '$member', t: '$type', mo: '$month' }, total: { $sum: '$amount' } } },
  ]);
  const map = {};
  for (const r of rows) {
    const id = String(r._id.m);
    const s = (map[id] = map[id] || { total: 0, monthTotal: 0, monthlyTotal: 0, extraTotal: 0, paidMonthly: false });
    s.total += r.total;
    if (r._id.t === 'monthly') s.monthlyTotal += r.total;
    else s.extraTotal += r.total;
    if (month && r._id.mo === month) {
      s.monthTotal += r.total;
      if (r._id.t === 'monthly') s.paidMonthly = true;
    }
  }
  return users.map((u) => ({
    _id: u._id,
    userId: u.userId,
    name: u.name,
    photo: u.photo,
    role: u.role,
    profession: u.profession,
    ...(map[String(u._id)] || { total: 0, monthTotal: 0, monthlyTotal: 0, extraTotal: 0, paidMonthly: false }),
  }));
};

router.get(
  '/summary',
  wrap(async (req, res) => {
    const month = checkMonth(req.query.month);
    const base = await getBalance();
    const [monthCollected, monthDonated, monthlyType, extraType, pc, dc] = await Promise.all([
      month ? sum(Payment, { status: 'approved', month }) : 0,
      month ? sum(Donation, { status: 'approved', month }) : 0,
      sum(Payment, { status: 'approved', type: 'monthly' }),
      sum(Payment, { status: 'approved', type: 'extra' }),
      Payment.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: '$month', total: { $sum: '$amount' } } }]),
      Donation.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: '$month', total: { $sum: '$amount' } } }]),
    ]);

    const byMonth = {};
    pc.forEach((r) => ((byMonth[r._id] = byMonth[r._id] || { month: r._id, collected: 0, donated: 0 }).collected = r.total));
    dc.forEach((r) => ((byMonth[r._id] = byMonth[r._id] || { month: r._id, collected: 0, donated: 0 }).donated = r.total));
    const monthly = Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);

    res.json({ ...base, monthCollected, monthDonated, monthlyType, extraType, monthly });
  })
);

router.get(
  '/members',
  wrap(async (req, res) => {
    res.json(await memberStats(checkMonth(req.query.month)));
  })
);

// Everything needed to build a PDF on the client
router.get(
  '/report',
  wrap(async (req, res) => {
    const month = checkMonth(req.query.month);
    const member = req.query.member || null;

    const pf = { status: 'approved' };
    const df = { status: 'approved' };
    const year = req.query.year || null;
    if (year && !/^\d{4}$/.test(String(year))) throw httpError(400, 'Invalid year');
    const period = month || (year ? { $regex: `^${year}-` } : null);
    if (period) {
      pf.month = period;
      df.month = period;
    }
    if (member) {
      pf.member = member;
      df.requestedBy = member;
    }

    const [payments, donations, overall, users] = await Promise.all([
      Payment.find(pf).sort({ month: 1, createdAt: 1 }).populate('member', 'name userId').populate('toAdmin', 'name'),
      Donation.find(df).sort({ month: 1, createdAt: 1 }).populate('requestedBy', 'name userId'),
      getBalance(),
      member ? [] : User.find({ active: true }).select('name userId').sort({ name: 1 }),
    ]);

    // Per-member totals for exactly the period being reported
    const members = users.map((u) => {
      const mine = payments.filter((p) => p.member && String(p.member._id) === String(u._id));
      const monthlyTotal = mine.filter((p) => p.type === 'monthly').reduce((s, p) => s + p.amount, 0);
      const extraTotal = mine.filter((p) => p.type === 'extra').reduce((s, p) => s + p.amount, 0);
      return { name: u.name, userId: u.userId, monthlyTotal, extraTotal, total: monthlyTotal + extraTotal };
    });

    const collected = payments.reduce((s, p) => s + p.amount, 0);
    const donated = donations.reduce((s, d) => s + d.amount, 0);
    let memberName = null;
    if (member) {
      const u = await User.findById(member).select('name userId');
      memberName = u ? `${u.name} (${u.userId})` : null;
    }

    res.json({
      generatedAt: new Date().toISOString(),
      period: month || year || 'All time',
      memberName,
      summary: { collected, donated, net: collected - donated, fundBalance: overall.balance },
      members,
      payments,
      donations,
    });
  })
);

module.exports = router;
