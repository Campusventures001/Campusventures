const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-me';
  process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@campusventure.local';
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPass123';
  require('./Server.js');
  console.log(`[dev-mongo] In-memory MongoDB at ${mongod.getUri()}`);
})().catch((err) => { console.error(err); process.exit(1); });
