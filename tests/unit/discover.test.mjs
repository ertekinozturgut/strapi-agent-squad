import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverProject } from '../../src/lib/discover.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('discovers Strapi schemas and static routes through the TypeScript AST', async () => {
  const manifest = await discoverProject(path.join(root, 'fixtures', 'secure'));
  assert.equal(manifest.project.strapiVersion, '5.52.0');
  assert.equal(manifest.project.typescript, true);
  assert.equal(manifest.project.packageManager, 'pnpm');
  assert.equal(manifest.contentTypes[0].uid, 'api::article.article');
  assert.equal(manifest.features.localPlugins, false);
  assert.deepEqual(manifest.surfaces.controllers, ['src/api/article/controllers/article.ts']);
  assert.equal(manifest.usages.documentService.length, 1);
  assert.deepEqual(manifest.routes[0], {
    method: 'GET',
    path: '/articles/featured',
    handler: 'api::article.article.featured',
    scope: 'content-api',
    auth: true,
    policies: ['api::article.can-read'],
    middlewares: [],
    source: 'src/api/article/routes/custom.ts',
  });
});

test('records dynamic route expressions for human review', async () => {
  const manifest = await discoverProject(path.join(root, 'fixtures', 'edge'));
  assert.equal(manifest.routes.length, 1);
  assert.equal(manifest.dynamicRoutes.length, 1);
  assert.match(manifest.dynamicRoutes[0].expression, /conditionalRoutes/);
});
