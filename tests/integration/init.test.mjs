import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { applyInit, planInit } from '../../src/lib/init.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('initializer is conservative and adds deterministic scripts', async () => {
  const target = await mkdtemp(path.join(tmpdir(), 'strapi-squad-init-'));
  await cp(path.join(root, 'fixtures', 'secure', 'package.json'), path.join(target, 'package.json'));
  await cp(path.join(root, 'fixtures', 'secure', 'pnpm-lock.yaml'), path.join(target, 'pnpm-lock.yaml'));
  await cp(path.join(root, 'fixtures', 'secure', 'tsconfig.json'), path.join(target, 'tsconfig.json'));
  const plan = await planInit(target);
  assert.deepEqual(plan.issues, []);
  const applied = await applyInit(plan);
  assert.ok(applied.changes.includes('.agents/INIT.md'));
  const packageJson = JSON.parse(await readFile(path.join(target, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['squad:testgen:check'], 'strapi-squad testgen --check');
  const second = await planInit(target);
  assert.ok(second.conflicts.includes('.agents/INIT.md'));
});
