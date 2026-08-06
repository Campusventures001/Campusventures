const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  message: { type: String, trim: true, default: '' },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Inquiry', inquirySchema);
