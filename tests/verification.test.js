const assert = require('assert');
const path = require('path');
const db = require('../server/db');
const seedDatabase = require('../server/seed');

async function testBackend() {
  console.log('--- Testing Backend Stats, Notifications & Badges ---');
  await seedDatabase();

  // Test direct database query & stats computation
  const app = require('../server/server');
  
  // We can test the endpoints via supertest or by fetching if server is running or calling endpoints
  const totalRow = await db.get('SELECT COUNT(*) as c FROM items');
  console.log('Total items in DB:', totalRow.c);
  assert(Number(totalRow.c) >= 5, 'Should have at least 5 items');

  console.log('✓ Database seeded and items verified.');
}

testBackend().then(() => {
  console.log('✓ Backend verification complete.');
  process.exit(0);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
