import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';
import { checkGeneratedTests, generateTests } from '../../src/lib/generate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function fixtureCopy(name) {
  const directory = await mkdtemp(path.join(tmpdir(), `strapi-squad-${name}-`));
  await cp(path.join(root, 'fixtures', name), directory, { recursive: true });
  return directory;
}

test('test generation is deterministic and check detects no drift', async () => {
  const target = await fixtureCopy('secure');
  const first = await generateTests(target, { write: true });
  const before = await readFile(path.join(target, 'tests/generated/strapi-contracts.generated.test.ts'), 'utf8');
  const second = await generateTests(target, { write: true });
  const after = await readFile(path.join(target, 'tests/generated/strapi-contracts.generated.test.ts'), 'utf8');
  assert.deepEqual(first.files, second.files);
  assert.equal(before, after);
  assert.ok(first.testPlan.tests.some((item) => item.kind === 'draft-publish-visibility'));
  assert.ok(first.testPlan.tests.some((item) => item.kind === 'required-field'));
  assert.ok(first.files.includes('tests/generated/strapi-schema-cases.generated.test.ts'));
  for (const relative of first.files.filter((file) => file.endsWith('.ts'))) {
    const source = await readFile(path.join(target, relative), 'utf8');
    const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    const errors = (compiled.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
  }
  await checkGeneratedTests(target);
});

test('unreviewed anonymous routes block generation', async () => {
  const target = await fixtureCopy('vulnerable');
  await assert.rejects(() => generateTests(target, { write: false }), (error) => {
    assert.equal(error.exitCode, 2);
    assert.ok(error.validation.blockers.some((blocker) => blocker.code === 'AUTH-001'));
    return true;
  });
});

test('runtime generation is explicit and loopback-only', async () => {
  const target = await fixtureCopy('secure');
  await writeFile(path.join(target, '.agents/testgen.config.yaml'), `version: 1
runner: vitest
runtime:
  enabled: true
  baseUrl: http://127.0.0.1:1337
routeExpectations:
  - id: featured-authenticated
    method: GET
    path: /articles/featured
    identity: authenticated
    expectedStatus: [200, 401]
identities:
  - name: authenticated
    type: bearer
publicRoutes: []
pii:
  fields: []
  reviewedNonPii: []
`);
  const result = await generateTests(target, { write: true });
  assert.ok(result.files.includes('tests/generated/strapi-runtime.generated.test.ts'));
  const runtime = await readFile(path.join(target, 'tests/generated/strapi-runtime.generated.test.ts'), 'utf8');
  assert.match(runtime, /createIsolatedFetch/);

  await writeFile(path.join(target, '.agents/testgen.config.yaml'), `version: 1
runner: vitest
runtime:
  enabled: true
  baseUrl: https://staging.example.com
routeExpectations: []
pii:
  fields: []
  reviewedNonPii: []
`);
  await assert.rejects(() => generateTests(target), (error) => error.validation.blockers.some((item) => item.code === 'RUNTIME-001'));
});
