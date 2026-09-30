import { readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { exists } from './utils.mjs';

export const defaultTestgenConfig = {
  version: 1,
  runner: 'vitest',
  database: { fast: 'sqlite', parity: null },
  runtime: { enabled: false, baseUrl: 'http://127.0.0.1:1337' },
  routeExpectations: [],
  identities: [{ name: 'anonymous', type: 'anonymous' }],
  publicRoutes: [],
  pii: { fields: [], reviewedNonPii: [] },
  ownership: [],
  externalServices: [],
  stateMachines: [],
};

export async function loadTestgenConfig(root) {
  const filePath = path.join(root, '.agents', 'testgen.config.yaml');
  if (!(await exists(filePath))) return { ...defaultTestgenConfig, missing: true };
  const parsed = YAML.parse(await readFile(filePath, 'utf8')) ?? {};
  return {
    ...defaultTestgenConfig,
    ...parsed,
    database: { ...defaultTestgenConfig.database, ...(parsed.database ?? {}) },
    runtime: { ...defaultTestgenConfig.runtime, ...(parsed.runtime ?? {}) },
    pii: { ...defaultTestgenConfig.pii, ...(parsed.pii ?? {}) },
    missing: false,
  };
}

function routeKey(route) {
  return `${route.method.toUpperCase()} ${route.path}`;
}

export function validateTestgenConfig(manifest, config) {
  const blockers = [];
  const warnings = [];
  if (config.missing) blockers.push({ code: 'CFG-001', message: '.agents/testgen.config.yaml is missing' });
  if (!['vitest', 'jest'].includes(config.runner)) blockers.push({ code: 'CFG-002', message: 'runner must be vitest or jest' });

  if (config.runtime?.enabled) {
    try {
      const url = new URL(config.runtime.baseUrl);
      if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
        blockers.push({ code: 'RUNTIME-001', message: `Runtime target must be loopback, received ${url.hostname}` });
      }
    } catch {
      blockers.push({ code: 'RUNTIME-002', message: 'runtime.baseUrl must be a valid URL' });
    }
    if (!Array.isArray(config.routeExpectations) || config.routeExpectations.length === 0) {
      blockers.push({ code: 'RUNTIME-003', message: 'Runtime testing is enabled but routeExpectations is empty' });
    }
  }

  for (const expectation of config.routeExpectations ?? []) {
    const key = `${String(expectation.method ?? '').toUpperCase()} ${expectation.path ?? ''}`;
    if (!manifest.routes.some((route) => routeKey(route) === key)) {
      blockers.push({ code: 'RUNTIME-004', message: `Runtime expectation does not match a discovered route: ${key}` });
    }
    if (!Array.isArray(expectation.expectedStatus) || expectation.expectedStatus.length === 0) {
      blockers.push({ code: 'RUNTIME-005', message: `Runtime expectation requires expectedStatus: ${key}` });
    }
  }

  const allowedPublic = new Set((config.publicRoutes ?? []).map((route) => `${String(route.method).toUpperCase()} ${route.path}`));
  for (const route of manifest.routes.filter((item) => item.auth === false)) {
    if (!allowedPublic.has(routeKey(route))) {
      blockers.push({ code: 'AUTH-001', message: `Public route is not approved: ${routeKey(route)}`, source: route.source });
    }
  }

  const pii = new Set(config.pii?.fields ?? []);
  const reviewed = new Set(config.pii?.reviewedNonPii ?? []);
  for (const candidate of manifest.piiCandidates) {
    const key = `${candidate.uid}.${candidate.field}`;
    if (!pii.has(key) && !reviewed.has(key)) {
      blockers.push({ code: 'PII-001', message: `PII candidate is not classified: ${key}` });
    } else if (pii.has(key) && !candidate.private) {
      warnings.push({ code: 'PII-002', message: `PII field is not marked private in schema: ${key}` });
    }
  }

  for (const dynamic of manifest.dynamicRoutes) {
    warnings.push({ code: 'ROUTE-001', message: `Dynamic route expression needs review: ${dynamic.expression}`, source: dynamic.source });
  }
  return { blockers, warnings };
}
