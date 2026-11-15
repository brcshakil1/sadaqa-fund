const router = require('express').Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth, adminOnly } = require('../middleware/auth');
const { wrap, httpError, isMonth, periodFilter, parseAmount } = require('../utils/helpers');

router.use(auth);

const populate = (q) => q.populate('member', 'name userId').populate('toAdmin', 'name userId').populate('reviewedBy', 'name');

// Member (or admin) reports money they sent to an admin
router.post(
  '/',
  wrap(async (req, res) => {
    const { amount, month, toAdmin, type, note } = req.body;
    const amt = parseAmount(amount);
    if (!isMonth(month)) throw httpError(400, 'Choose a valid month');
    if (!['monthly', 'extra'].includes(type)) throw httpError(400, 'Choose Monthly Sadaqah or Extra');
    const admin = await User.findOne({ _id: toAdmin, role: 'admin', active: true });
    if (!admin) throw httpError(400, 'Choose the admin you sent the money to');
    if (String(admin._id) === String(req.user._id))
      throw httpError(400, 'Choose the other admin - a different admin must confirm your payment');

    const p = await Payment.create({
      member: req.user._id,
      toAdmin: admin._id,
      amount: amt,
      month,
      type,
      note: note || '',
    });
    await Notification.create({
      user: admin._id,
      type: 'payment',
      message: `${req.user.name} says they sent ${amt} (${type === 'monthly' ? 'monthly Sadaqah' : 'extra'}) for ${month}. Please confirm.`,
      link: '/approvals',
    });
    res.status(201).json(p);
  })
);

// My own submissions (all statuses)
router.get(
  '/mine',
  wrap(async (req, res) => {
    res.json(await populate(Payment.find({ member: req.user._id }).sort({ createdAt: -1 }).limit(200)));
  })
);

// Admin: pending payments addressed to me
router.get(
  '/pending',
  adminOnly,
  wrap(async (req, res) => {
    res.json(await populate(Payment.find({ status: 'pending', toAdmin: req.user._id }).sort({ createdAt: 1 })));
  })
);

// All confirmed payments (visible to everyone in the fund).
// Filters: ?year=YYYY  ?monthNum=MM  ?month=YYYY-MM  ?member=<userObjectId>  ?type=monthly|extra
router.get(
  '/',
  wrap(async (req, res) => {
    const filter = { status: 'approved' };
    const period = periodFilter(req.query);
    if (period) filter.month = period;
    if (req.query.member) filter.member = req.query.member;
    if (req.query.type) {
      if (!['monthly', 'extra'].includes(req.query.type)) throw httpError(400, 'Invalid type');
      filter.type = req.query.type;
    }
    res.json(await populate(Payment.find(filter).sort({ month: -1, createdAt: -1 }).limit(3000)));
  })
);

// Admin confirms or rejects a payment sent to them
router.patch(
  '/:id/review',
  adminOnly,
  wrap(async (req, res) => {
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) throw httpError(400, 'Invalid action');
    const p = await Payment.findOneAndUpdate(
      { _id: req.params.id, status: 'pending', toAdmin: req.user._id },
      {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
        reviewNote: note || '',
      },
      { new: true }
    );
    if (!p) throw httpError(404, 'Not found, already reviewed, or not addressed to you');
    await Notification.create({
      user: p.member,
      type: 'payment',
      message:
        action === 'approve'
          ? `${req.user.name} confirmed your ${p.amount} for ${p.month}. Jazakallah khair!`
          : `${req.user.name} rejected your ${p.amount} for ${p.month}.${note ? ' Reason: ' + note : ''}`,
      link: '/history',
    });
    res.json(p);
  })
);

// Cancel my own pending submission
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const p = await Payment.findOneAndDelete({ _id: req.params.id, member: req.user._id, status: 'pending' });
    if (!p) throw httpError(404, 'Only your own pending submissions can be cancelled');
    res.json({ message: 'Cancelled' });
  })
);

module.exports = router;
