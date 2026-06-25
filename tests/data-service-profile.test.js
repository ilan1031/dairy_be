const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const dataService = require('../dist/services/data.service');
const seedService = require('../dist/services/seed.service');

async function resetDataStore() {
  const dataDir = path.join(__dirname, '..', 'data');
  await Promise.all([
    'users.json',
    'profile.json',
    'audit_logs.json',
    'meta.json',
  ].map((file) => fs.writeFile(path.join(dataDir, file), '[]', 'utf-8').catch(() => {})));
}

test('bootstrap returns the business profile for superadmin login', async () => {
  await resetDataStore();
  await seedService.seedIfEmpty();
  const data = await dataService.bootstrap(null, { isSuperAdmin: true });

  assert.ok(data.profile, 'Expected bootstrap to return a business profile');
  assert.equal(data.profile.emailAddress, 'arun@gangadairy.com');
});
