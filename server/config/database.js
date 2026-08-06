const mongoose = require('mongoose');

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing. Add it to the .env file.');
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || 'campus-venture',
    serverSelectionTimeoutMS: 10000
  });
  console.log('Connected to MongoDB.');
}

module.exports = connectDatabase;
