import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSecurity } from '../../src/lib/security.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('secure fixture has no blocking findings', async () => {
  const report = await scanSecurity(path.join(root, 'fixtures', 'secure'));
  assert.equal(report.summary.S1, 0);
});

test('vulnerable fixture proves blocking rules', async () => {
  const report = await scanSecurity(path.join(root, 'fixtures', 'vulnerable'));
  const rules = new Set(report.findings.map((finding) => finding.ruleId));
  for (const expected of [
    'STRAPI-AUTH-001',
    'STRAPI-SAN-003',
    'STRAPI-SEC-001',
    'STRAPI-SEC-002',
    'STRAPI-SEC-003',
    'STRAPI-SEC-004',
    'STRAPI-SEC-007',
    'STRAPI-SEC-008',
    'STRAPI-SEC-009',
    'STRAPI-SUP-001',
    'STRAPI-SUP-002',
  ]) assert.ok(rules.has(expected), `missing fixture coverage for ${expected}`);
  assert.ok(report.summary.S1 >= 11);
  assert.equal(JSON.stringify(report).includes('synthetic_fixture_password_123'), false);
});
