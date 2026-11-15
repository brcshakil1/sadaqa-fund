const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { wrap, httpError } = require('../utils/helpers');

const publicUser = (u) => ({
  _id: u._id,
  userId: u.userId,
  name: u.name,
  role: u.role,
  photo: u.photo,
  address: u.address,
  profession: u.profession,
});

router.post(
  '/login',
  wrap(async (req, res) => {
    const { userId, password } = req.body;
    if (!userId || !password) throw httpError(400, 'Enter your ID and password');
    const user = await User.findOne({ userId: String(userId).trim().toLowerCase() }).select('+password');
    if (!user || !(await user.checkPassword(String(password)))) throw httpError(401, 'Wrong ID or password');
    if (!user.active) throw httpError(403, 'This account is disabled. Contact an admin.');
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '14d' });
    res.json({ token, user: publicUser(user) });
  })
);

router.get('/me', auth, (req, res) => res.json(publicUser(req.user)));

router.put(
  '/password',
  auth,
  wrap(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) throw httpError(400, 'New password must be at least 6 characters');
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.checkPassword(String(currentPassword || '')))) throw httpError(400, 'Current password is wrong');
    user.password = String(newPassword);
    await user.save();
    res.json({ message: 'Password changed' });
  })
);

module.exports = router;
