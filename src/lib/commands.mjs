import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { discoverProject } from './discover.mjs';
import { applyInit, planInit } from './init.mjs';
import { checkGeneratedTests, generateTests } from './generate.mjs';
import { scanSecurity } from './security.mjs';
import { writeSecurityReports } from './report.mjs';
import { loadTestgenConfig, validateTestgenConfig } from './config.mjs';
import { readJson, stableStringify, writeDeterministic } from './utils.mjs';

function output(value, format = 'json') {
  if (format === 'json') process.stdout.write(stableStringify(value));
  else process.stdout.write(`${String(value)}\n`);
}

function targetFrom(options) {
  return path.resolve(String(options.target ?? process.cwd()));
}

export async function initCommand(options) {
  const plan = await planInit(targetFrom(options));
  if (!options.write) return output({ mode: 'dry-run', creates: plan.creates, conflicts: plan.conflicts, issues: plan.issues, packageManager: plan.packageManager });
  const result = await applyInit(plan);
  output({ mode: 'write', changes: result.changes, conflictsPreserved: result.conflicts });
}

export async function doctorCommand(options) {
  const root = targetFrom(options);
  const manifest = await discoverProject(root);
  const config = await loadTestgenConfig(root);
  const validation = validateTestgenConfig(manifest, config);
  const strapiMajor = String(manifest.project.strapiVersion ?? '').match(/(\d+)/)?.[1];
  const checks = {
    strapi5: strapiMajor === '5',
    typescript: manifest.project.typescript,
    packageManager: manifest.project.packageManager !== 'unknown',
    testContract: validation.blockers.length === 0,
  };
  output({ checks, validation, project: manifest.project });
  if (Object.values(checks).some((value) => value === false)) process.exitCode = 2;
}

export async function discoverCommand(options) {
  const root = targetFrom(options);
  const manifest = await discoverProject(root);
  if (options.write) await writeDeterministic(path.join(root, '.agents', 'generated', 'strapi-test-manifest.json'), stableStringify(manifest));
  output(manifest);
}

export async function testgenCommand(options) {
  const root = targetFrom(options);
  const result = options.check ? await checkGeneratedTests(root) : await generateTests(root, { write: Boolean(options.write) });
  output({ digest: result.manifest.digest, changes: result.changes, warnings: result.validation.warnings, files: result.files });
}

export async function securityCommand(options) {
  const root = targetFrom(options);
  const report = await scanSecurity(root);
  if (options.write || options.format === 'sarif' || options.format === 'markdown') await writeSecurityReports(root, report);
  output(report);
  if (report.summary.S1 > 0) process.exitCode = 1;
}

function runScript(root, packageManager, script) {
  const args = packageManager === 'npm' ? ['run', script] : ['run', script];
  const result = spawnSync(packageManager, args, { cwd: root, stdio: 'inherit', env: { ...process.env, CI: 'true' } });
  return result.status ?? 1;
}

export async function checkCommand(options, full = false) {
  const root = targetFrom(options);
  const manifest = await discoverProject(root);
  await checkGeneratedTests(root);
  const report = await scanSecurity(root);
  await writeSecurityReports(root, report);
  const scripts = [];
  const packageJson = await readJson(path.join(root, 'package.json'));
  for (const script of ['typecheck', 'lint', 'test', ...(full ? ['build'] : [])]) {
    if (packageJson.scripts?.[script] && !packageJson.scripts[script].includes('strapi-squad')) scripts.push(script);
  }
  const failures = [];
  for (const script of scripts) if (runScript(root, manifest.project.packageManager, script) !== 0) failures.push(script);
  output({ project: manifest.project, scripts, failures, security: report.summary });
  if (failures.length > 0 || report.summary.S1 > 0) process.exitCode = 1;
}

export async function reportCommand(options) {
  const root = targetFrom(options);
  const report = await scanSecurity(root);
  const directory = await writeSecurityReports(root, report);
  output({ directory, summary: report.summary });
}
