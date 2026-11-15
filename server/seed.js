// Optional: run `npm run seed` to create the first admin without starting the server.
require('dotenv').config();
const mongoose = require('mongoose');
const { ensureAdmin } = require('./utils/bootstrap');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await ensureAdmin();
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
