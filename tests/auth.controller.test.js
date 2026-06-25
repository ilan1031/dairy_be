const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const authController = require('../dist/controllers/auth.controller');
const dataService = require('../dist/services/data.service');
const ipLimitService = require('../dist/services/ipLimit.service');

async function resetDataStore() {
  const dataDir = path.join(__dirname, '..', 'data');
  await Promise.all([
    'users.json',
    'profile.json',
    'audit_logs.json',
    'meta.json',
  ].map((file) => fs.writeFile(path.join(dataDir, file), '[]', 'utf-8').catch(() => {})));
}

function createRes() {
  const res = {
    statusCode: 200,
    body: null,
    cookies: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, value, options) {
      this.cookies[name] = { value, options };
      return this;
    },
    clearCookie(name, options) {
      this.cookies[name] = { cleared: true, options };
      return this;
    },
  };

  return res;
}

test('register rejects duplicate emails and records an audit entry with the client IP', async () => {
  await resetDataStore();
  const emailAddress = `signup-dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const req = {
    body: {
      businessName: 'Test Dairy',
      ownerName: 'Test Owner',
      mobileNumber: '9999999999',
      emailAddress,
      password: 'secret123',
    },
    headers: {
      'x-forwarded-for': '203.0.113.9',
      'user-agent': 'node-test',
    },
  };

  const firstRes = createRes();
  await authController.register(req, firstRes);
  assert.equal(firstRes.statusCode, 200);

  const duplicateRes = createRes();
  await authController.register(req, duplicateRes);
  assert.equal(duplicateRes.statusCode, 409);
  assert.match(duplicateRes.body.error, /already registered/i);

  const auditLogs = await dataService.getAuditLogs({ search: emailAddress, limit: 20 });
  const duplicateAudit = auditLogs.logs.find((entry) => entry.userEmail === emailAddress && entry.action === 'signup_failed');

  assert.ok(duplicateAudit, 'Expected a failed signup audit log');
  assert.equal(duplicateAudit.details?.ipAddress, '203.0.113.9');
});

test('signup honors the per-IP user limit and allows a super admin override', async () => {
  await resetDataStore();
  const ipAddress = '198.51.100.20';

  for (let index = 0; index < 3; index += 1) {
    const res = createRes();
    const emailAddress = `ip-limit-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await authController.register({
      body: {
        businessName: 'Limit Test Dairy',
        ownerName: `Owner ${index}`,
        mobileNumber: `900000000${index}`,
        emailAddress,
        password: 'secret123',
      },
      headers: { 'x-forwarded-for': ipAddress },
    }, res);
    assert.equal(res.statusCode, 200, `expected registration ${index + 1} to succeed`);
  }

  const blocked = createRes();
  await authController.register({
    body: {
      businessName: 'Limit Test Dairy',
      ownerName: 'Owner 4',
      mobileNumber: '9000000004',
      emailAddress: `ip-limit-blocked-${Date.now()}@example.com`,
      password: 'secret123',
    },
    headers: { 'x-forwarded-for': ipAddress },
  }, blocked);
  assert.equal(blocked.statusCode, 429);
  assert.match(blocked.body.error, /limit/i);

  await ipLimitService.updateIpCreationLimit(ipAddress, 5);

  const allowed = createRes();
  await authController.register({
    body: {
      businessName: 'Limit Test Dairy',
      ownerName: 'Owner 5',
      mobileNumber: '9000000005',
      emailAddress: `ip-limit-allowed-${Date.now()}@example.com`,
      password: 'secret123',
    },
    headers: { 'x-forwarded-for': ipAddress },
  }, allowed);
  assert.equal(allowed.statusCode, 200);
});
