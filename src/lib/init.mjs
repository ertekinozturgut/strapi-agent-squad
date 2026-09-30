import { cp, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectPackageManager, exists, readJson, stableStringify, writeDeterministic } from './utils.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function strapiMajor(version) {
  const match = String(version ?? '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export async function planInit(targetRoot) {
  const root = path.resolve(targetRoot);
  const packagePath = path.join(root, 'package.json');
  const packageJson = await readJson(packagePath);
  const version = packageJson.dependencies?.['@strapi/strapi'] ?? packageJson.devDependencies?.['@strapi/strapi'];
  const issues = [];
  if (strapiMajor(version) !== 5) issues.push(`Expected Strapi 5, found ${version ?? 'no @strapi/strapi dependency'}`);
  if (!(await exists(path.join(root, 'tsconfig.json')))) issues.push('TypeScript project required: tsconfig.json is missing');
  const packageManager = await detectPackageManager(root);
  if (packageManager === 'unknown') issues.push('No supported lockfile found (pnpm, npm, or yarn)');

  const files = [
    ['.agents/INIT.md', '.agents/INIT.md'],
    ['.agents/rules', '.agents/rules'],
    ['.agents/skills', '.agents/skills'],
    ['.agents/rules_registry.yaml', '.agents/rules_registry.yaml'],
    ['.agents/security-exceptions.yaml', '.agents/security-exceptions.yaml'],
    ['.agents/security.config.yaml', '.agents/security.config.yaml'],
    ['.agents/license-policy.yaml', '.agents/license-policy.yaml'],
    ['templates/project/contract.yaml', '.agents/contract.yaml'],
    ['templates/project/testgen.config.yaml', '.agents/testgen.config.yaml'],
    ['templates/project/.dockerignore', '.dockerignore'],
    ['tasks.schema.json', 'tasks.schema.json'],
    ['tasks.template.json', 'tasks.template.json'],
    ['.semgrep', '.semgrep'],
    ['.codeql', '.codeql'],
    ['.github/codeql/extensions', '.github/codeql/extensions'],
    ['.gitleaks.toml', '.gitleaks.toml'],
    ['trivy.yaml', 'trivy.yaml'],
    ['AGENTS.md', 'AGENTS.md'],
    ['CLAUDE.md', 'CLAUDE.md'],
    ['.cursor/rules/strapi-agent-squad.mdc', '.cursor/rules/strapi-agent-squad.mdc'],
    ['templates/ci', '.agents/templates/ci'],
  ];
  const creates = [];
  const conflicts = [];
  for (const [, destination] of files) {
    if (await exists(path.join(root, destination))) conflicts.push(destination);
    else creates.push(destination);
  }

  const scripts = {
    'squad:doctor': 'strapi-squad doctor',
    'squad:discover': 'strapi-squad discover',
    'squad:testgen': 'strapi-squad testgen --write',
    'squad:testgen:check': 'strapi-squad testgen --check',
    'squad:check': 'strapi-squad check',
    'squad:verify': 'strapi-squad verify',
    'squad:security': 'strapi-squad security',
    'squad:report': 'strapi-squad report',
  };
  return { root, packageJson, version, packageManager, issues, files, creates, conflicts, scripts };
}

export async function applyInit(plan) {
  if (plan.issues.length > 0) {
    const error = new Error(`Initialization requirements failed: ${plan.issues.join('; ')}`);
    error.exitCode = 2;
    throw error;
  }
  const changes = [];
  for (const [source, destination] of plan.files) {
    const target = path.join(plan.root, destination);
    if (!(await exists(target))) {
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(packageRoot, source), target, { recursive: true, errorOnExist: true });
      changes.push(destination);
    }
  }

  const packageJson = structuredClone(plan.packageJson);
  packageJson.scripts = { ...(packageJson.scripts ?? {}), ...plan.scripts };
  packageJson.devDependencies = {
    ...(packageJson.devDependencies ?? {}),
    'strapi-agent-squad': 'github:ertekinozturgut/strapi-agent-squad',
  };
  const desired = stableStringify(packageJson);
  const current = await readFile(path.join(plan.root, 'package.json'), 'utf8');
  if (current !== desired) {
    await writeDeterministic(path.join(plan.root, 'package.json'), desired);
    changes.push('package.json');
  }
  await mkdir(path.join(plan.root, 'tests', 'generated'), { recursive: true });
  await mkdir(path.join(plan.root, 'tests', 'handwritten'), { recursive: true });
  return { ...plan, changes };
}
