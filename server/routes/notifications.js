const router = require('express').Router();
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const { wrap } = require('../utils/helpers');

router.use(auth);

router.get(
  '/',
  wrap(async (req, res) => {
    res.json(await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(60));
  })
);

router.get(
  '/unread-count',
  wrap(async (req, res) => {
    res.json({ count: await Notification.countDocuments({ user: req.user._id, read: false }) });
  })
);

router.patch(
  '/read-all',
  wrap(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ message: 'ok' });
  })
);

router.patch(
  '/:id/read',
  wrap(async (req, res) => {
    await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
    res.json({ message: 'ok' });
  })
);

module.exports = router;
