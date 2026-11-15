const User = require('../models/User');

// Create the very first admin so you can log in. Does nothing once any admin exists.
async function ensureAdmin() {
  if (await User.exists({ role: 'admin' })) return;
  const userId = (process.env.SEED_ADMIN_ID || '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!userId || !password) {
    console.warn('No admin exists. Set SEED_ADMIN_ID and SEED_ADMIN_PASSWORD in .env, then restart.');
    return;
  }
  await User.create({
    userId,
    name: process.env.SEED_ADMIN_NAME || 'Admin',
    password,
    role: 'admin',
  });
  console.log(`First admin created. Log in with ID "${userId}" and change the password.`);
}

module.exports = { ensureAdmin };
