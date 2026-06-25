const test = require('node:test');
const assert = require('node:assert/strict');
const dataService = require('../dist/services/data.service');

test('bootstrap returns the business profile for superadmin login', async () => {
  const data = await dataService.bootstrap(null, { isSuperAdmin: true });

  assert.ok(data.profile, 'Expected bootstrap to return a business profile');
  assert.equal(data.profile.emailAddress, 'abielan@superadmin.com');
});
