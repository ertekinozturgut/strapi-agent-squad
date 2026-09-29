import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertLoopbackUrl, createIsolatedFetch, duplicateRoutes, missingComponentReferences, schemaContractViolations, unsafePrivateFields } from '../../src/testkit.mjs';

test('route duplicate detection is scoped', () => {
  const routes = [
    { scope: 'admin', method: 'GET', path: '/items' },
    { scope: 'content-api', method: 'GET', path: '/items' },
    { scope: 'admin', method: 'GET', path: '/items' },
  ];
  assert.equal(duplicateRoutes(routes).length, 1);
});

test('schema helpers catch invalid enums, missing components, and public PII', () => {
  const contentTypes = [{
    uid: 'api::lead.lead',
    attributes: {
      email: { type: 'email' },
      status: { type: 'enumeration', enum: [] },
      seo: { type: 'component', component: 'seo.meta' },
    },
  }];
  assert.deepEqual(schemaContractViolations(contentTypes), ['api::lead.lead.status has an empty enumeration']);
  assert.deepEqual(missingComponentReferences(contentTypes, []), ['api::lead.lead.seo -> seo.meta']);
  assert.deepEqual(unsafePrivateFields(contentTypes, ['api::lead.lead.email']), ['api::lead.lead.email is not private']);
});

test('runtime target is limited to loopback', () => {
  assert.equal(assertLoopbackUrl('http://127.0.0.1:1337').hostname, '127.0.0.1');
  assert.throws(() => assertLoopbackUrl('https://cms.example.com'), /loopback/);
});

test('network isolation rejects real external calls before fetch', () => {
  let called = false;
  const isolatedFetch = createIsolatedFetch(async () => { called = true; });
  assert.throws(() => isolatedFetch('https://example.com/api'), /loopback/);
  assert.equal(called, false);
});
