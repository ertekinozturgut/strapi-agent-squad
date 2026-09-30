import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json']);

export async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function walk(root, predicate = () => true) {
  const results = [];
  if (!(await exists(root))) return results;

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', 'build', '.cache', '.tmp', 'coverage'].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (predicate(absolute)) results.push(absolute);
    }
  }

  await visit(root);
  return results;
}

export function normalizePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export async function hashFile(filePath) {
  return sha256(await readFile(filePath));
}

export function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)])
    );
  }
  return value;
}

export function stableStringify(value, spacing = 2) {
  return `${JSON.stringify(stableValue(value), null, spacing)}\n`;
}

export async function writeDeterministic(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  const current = (await exists(filePath)) ? await readFile(filePath, 'utf8') : null;
  if (current === normalized) return false;
  await writeFile(filePath, normalized, 'utf8');
  return true;
}

export function ensureInside(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Path escapes target directory: ${candidate}`);
  }
  return resolvedCandidate;
}

export function parseOptions(args) {
  const options = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith('--')) {
      options._.push(value);
      continue;
    }
    const [rawKey, inline] = value.slice(2).split('=', 2);
    if (inline !== undefined) options[rawKey] = inline;
    else if (args[index + 1] && !args[index + 1].startsWith('--')) options[rawKey] = args[++index];
    else options[rawKey] = true;
  }
  return options;
}

export function detectPackageManager(root) {
  return Promise.all([
    exists(path.join(root, 'pnpm-lock.yaml')),
    exists(path.join(root, 'yarn.lock')),
    exists(path.join(root, 'package-lock.json')),
  ]).then(([pnpm, yarn, npm]) => (pnpm ? 'pnpm' : yarn ? 'yarn' : npm ? 'npm' : 'unknown'));
}

export async function fileSize(filePath) {
  return (await stat(filePath)).size;
}
