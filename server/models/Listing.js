const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  location: { type: String, required: true, trim: true },
  demand: { type: String, required: true, trim: true },
  plot: { type: String, default: '' },
  constructed: { type: String, default: '' },
  classUpTo: { type: String, default: '' },
  students: { type: String, default: '' },
  fee: { type: String, default: '' },
  board: { type: String, default: '' },
  state: { type: String, default: '' },
  established: { type: String, default: '' },
  bankLoan: { type: String, default: '' },
  extra: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Listing', listingSchema);
