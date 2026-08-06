const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  interest: { type: String, enum: ['buy', 'sell', 'both'], default: 'buy' },
  source: { type: String, default: 'website' },
  notes: { type: String, default: '' }
}, { timestamps: true });

leadSchema.index({ email: 1 });
leadSchema.index({ phone: 1 });

module.exports = mongoose.model('Lead', leadSchema);