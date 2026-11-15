const router = require('express').Router();
const Donation = require('../models/Donation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth, adminOnly } = require('../middleware/auth');
const { wrap, httpError, isMonth, periodFilter, parseAmount, getBalance } = require('../utils/helpers');

router.use(auth);

const populate = (q) => q.populate('requestedBy', 'name userId').populate('reviewedBy', 'name');

// Anyone (member or admin) proposes a donation out of the fund
router.post(
  '/',
  wrap(async (req, res) => {
    const { amount, month, recipientName, recipientAddress, reason } = req.body;
    const amt = parseAmount(amount);
    if (!isMonth(month)) throw httpError(400, 'Choose a valid month');
    if (!recipientName || !String(recipientName).trim()) throw httpError(400, 'Enter the name of the person to donate to');

    const d = await Donation.create({
      requestedBy: req.user._id,
      amount: amt,
      month,
      recipientName: String(recipientName).trim(),
      recipientAddress: recipientAddress || '',
      reason: reason || '',
    });

    const admins = await User.find({ role: 'admin', active: true, _id: { $ne: req.user._id } }).select('_id');
    if (admins.length) {
      await Notification.insertMany(
        admins.map((a) => ({
          user: a._id,
          type: 'donation',
          message: `${req.user.name} requested a donation of ${amt} to ${d.recipientName}. Please review.`,
          link: '/approvals',
        }))
      );
    }
    res.status(201).json(d);
  })
);

router.get(
  '/mine',
  wrap(async (req, res) => {
    res.json(await populate(Donation.find({ requestedBy: req.user._id }).sort({ createdAt: -1 }).limit(200)));
  })
);

// Admin: pending donation requests from others (you cannot approve your own)
router.get(
  '/pending',
  adminOnly,
  wrap(async (req, res) => {
    res.json(
      await populate(Donation.find({ status: 'pending', requestedBy: { $ne: req.user._id } }).sort({ createdAt: 1 }))
    );
  })
);

// All approved donations (visible to everyone in the fund).
// Filters: ?year=YYYY  ?monthNum=MM  ?month=YYYY-MM  ?member=<id of who requested it>
router.get(
  '/',
  wrap(async (req, res) => {
    const filter = { status: 'approved' };
    const period = periodFilter(req.query);
    if (period) filter.month = period;
    if (req.query.member) filter.requestedBy = req.query.member;
    res.json(await populate(Donation.find(filter).sort({ month: -1, createdAt: -1 }).limit(3000)));
  })
);

router.patch(
  '/:id/review',
  adminOnly,
  wrap(async (req, res) => {
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) throw httpError(400, 'Invalid action');
    const d = await Donation.findOne({ _id: req.params.id, status: 'pending' });
    if (!d) throw httpError(404, 'Not found or already reviewed');
    if (String(d.requestedBy) === String(req.user._id))
      throw httpError(403, 'The other admin must review your own request');

    if (action === 'approve') {
      const { balance } = await getBalance();
      if (d.amount > balance) throw httpError(400, `Not enough in the fund. Current balance is ${balance}`);
    }

    d.status = action === 'approve' ? 'approved' : 'rejected';
    d.reviewedBy = req.user._id;
    d.reviewedAt = new Date();
    d.reviewNote = note || '';
    await d.save();

    await Notification.create({
      user: d.requestedBy,
      type: 'donation',
      message:
        action === 'approve'
          ? `${req.user.name} approved your donation of ${d.amount} to ${d.recipientName}.`
          : `${req.user.name} rejected your donation request of ${d.amount} to ${d.recipientName}.${note ? ' Reason: ' + note : ''}`,
      link: '/history',
    });
    res.json(d);
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    const d = await Donation.findOneAndDelete({ _id: req.params.id, requestedBy: req.user._id, status: 'pending' });
    if (!d) throw httpError(404, 'Only your own pending requests can be cancelled');
    res.json({ message: 'Cancelled' });
  })
);

module.exports = router;
