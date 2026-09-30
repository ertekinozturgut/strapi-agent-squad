#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';

const policy = YAML.parse(await readFile(new URL('../.agents/license-policy.yaml', import.meta.url), 'utf8'));
const result = spawnSync('pnpm', ['licenses', 'list', '--json', '--prod'], { encoding: 'utf8' });
if (result.status !== 0) {
  process.stderr.write(result.stderr || 'Unable to enumerate dependency licenses\n');
  process.exit(result.status || 1);
}

const inventory = JSON.parse(result.stdout);
const allow = new Set(policy.allow ?? []);
const deny = new Set(policy.deny ?? []);
const failures = [];
for (const [license, packages] of Object.entries(inventory)) {
  if (deny.has(license) || !allow.has(license)) {
    failures.push({ license, packages: packages.map((item) => `${item.name}@${item.versions.join(',')}`) });
  }
}
if (failures.length > 0) {
  process.stderr.write(`${JSON.stringify({ message: 'Dependency license policy failed', failures }, null, 2)}\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify({ licenses: Object.keys(inventory).sort(), status: 'ok' }, null, 2)}\n`);
