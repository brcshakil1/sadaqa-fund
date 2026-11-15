const router = require('express').Router();
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');
const { wrap, httpError, cleanPhoto } = require('../utils/helpers');

router.use(auth);

// List people in the fund. Members see active people only; admins see everyone.
router.get(
  '/',
  wrap(async (req, res) => {
    const filter = req.user.role === 'admin' ? {} : { active: true };
    res.json(await User.find(filter).select('-password').sort({ name: 1 }));
  })
);

// Member edits own profile (not role / ID / active)
router.put(
  '/me',
  wrap(async (req, res) => {
    const { name, address, profession, photo } = req.body;
    const u = req.user;
    if (name !== undefined) {
      if (!String(name).trim()) throw httpError(400, 'Name cannot be empty');
      u.name = String(name).trim();
    }
    if (address !== undefined) u.address = String(address).trim();
    if (profession !== undefined) u.profession = String(profession).trim();
    if (photo !== undefined) u.photo = cleanPhoto(photo);
    await u.save();
    res.json({
      _id: u._id, userId: u.userId, name: u.name, role: u.role,
      photo: u.photo, address: u.address, profession: u.profession,
    });
  })
);

// Admin creates an account (member or another admin)
router.post(
  '/',
  adminOnly,
  wrap(async (req, res) => {
    const { userId, name, password, role, address, profession, photo } = req.body;
    if (!userId || !name || !password) throw httpError(400, 'ID, name and password are required');
    if (String(password).length < 6) throw httpError(400, 'Password must be at least 6 characters');
    const id = String(userId).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(id)) throw httpError(400, 'ID: 3-30 letters, numbers, dot, dash or underscore');
    if (await User.exists({ userId: id })) throw httpError(400, 'This ID is already used');
    const u = await User.create({
      userId: id,
      name: String(name).trim(),
      password: String(password),
      role: role === 'admin' ? 'admin' : 'member',
      address: address || '',
      profession: profession || '',
      photo: cleanPhoto(photo),
    });
    const { password: _pw, ...safe } = u.toObject();
    res.status(201).json(safe);
  })
);

// Admin edits any account
router.put(
  '/:id',
  adminOnly,
  wrap(async (req, res) => {
    const u = await User.findById(req.params.id).select('+password');
    if (!u) throw httpError(404, 'User not found');
    const { name, role, address, profession, photo, active, password } = req.body;

    const newRole = role === undefined ? u.role : role === 'admin' ? 'admin' : 'member';
    const newActive = active === undefined ? u.active : !!active;

    if (String(u._id) === String(req.user._id) && !newActive) throw httpError(400, 'You cannot disable your own account');
    if (u.role === 'admin' && (newRole !== 'admin' || !newActive)) {
      const others = await User.countDocuments({ role: 'admin', active: true, _id: { $ne: u._id } });
      if (others < 1) throw httpError(400, 'The fund must keep at least one active admin');
    }

    if (name !== undefined && String(name).trim()) u.name = String(name).trim();
    if (address !== undefined) u.address = String(address).trim();
    if (profession !== undefined) u.profession = String(profession).trim();
    if (photo !== undefined) u.photo = cleanPhoto(photo);
    u.role = newRole;
    u.active = newActive;
    if (password) {
      if (String(password).length < 6) throw httpError(400, 'Password must be at least 6 characters');
      u.password = String(password);
    }
    await u.save();
    const { password: _pw, ...safe } = u.toObject();
    res.json(safe);
  })
);

module.exports = router;
