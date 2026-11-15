const mongoose = require('mongoose');

// Money given OUT of the fund to someone in need. Deducted only after an admin approves.
const donationSchema = new mongoose.Schema(
  {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    month: { type: String, required: true, index: true }, // "YYYY-MM"
    recipientName: { type: String, required: true, trim: true },
    recipientAddress: { type: String, default: '', trim: true },
    reason: { type: String, default: '', trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Donation', donationSchema);
