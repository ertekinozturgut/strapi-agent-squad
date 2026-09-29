import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { discoverProject } from './discover.mjs';
import { loadTestgenConfig } from './config.mjs';
import { normalizePath, walk } from './utils.mjs';

const RULES = [
  {
    id: 'STRAPI-SEC-001', severity: 'S1', cwe: 'CWE-95', asvs: 'V5', owner: 'security-reviewer',
    pattern: /\b(?:eval|Function)\s*\(/g,
    message: 'Dynamic code execution is forbidden',
    remediation: 'Replace dynamic execution with an explicit parser or allowlisted dispatch table.',
  },
  {
    id: 'STRAPI-SEC-002', severity: 'S1', cwe: 'CWE-78', asvs: 'V5', owner: 'security-reviewer',
    pattern: /(?:exec|execSync|spawn|spawnSync)\s*\([^\n]*(?:ctx\.|request\.|query\.|params\.)/g,
    message: 'Request-controlled data reaches a process execution API',
    remediation: 'Remove shell execution or pass fixed arguments through an allowlist.',
  },
  {
    id: 'STRAPI-SEC-003', severity: 'S1', cwe: 'CWE-532', asvs: 'V14', owner: 'security-reviewer',
    pattern: /console\.(?:log|info|warn|error)\s*\([^\n]*(?:ctx\.request|request\.body|authorization|cookie)/gi,
    message: 'Sensitive request data may be written to logs',
    remediation: 'Log an allowlisted, redacted event object instead of request bodies or credentials.',
  },
  {
    id: 'STRAPI-SEC-004', severity: 'S1', cwe: 'CWE-798', asvs: 'V13', owner: 'security-reviewer',
    pattern: /(?:secret|api[_-]?key|password|token)\s*[:=]\s*['"][A-Za-z0-9_\-+/=]{16,}['"]/gi,
    message: 'Possible hard-coded credential',
    remediation: 'Move the value to an environment-backed secret manager and rotate it.',
  },
  {
    id: 'STRAPI-SEC-005', severity: 'S2', cwe: 'CWE-918', asvs: 'V4', owner: 'platform-integration-engineer',
    pattern: /\bfetch\s*\(/g,
    message: 'Outbound fetch requires a bounded timeout and target validation',
    remediation: 'Use AbortSignal.timeout and validate the destination against an allowlist.',
    predicate: (source) => !/AbortSignal\.timeout|signal\s*:/.test(source),
  },
  {
    id: 'STRAPI-SEC-006', severity: 'S2', cwe: 'CWE-770', asvs: 'V4', owner: 'strapi-backend-engineer',
    pattern: /populate\s*:\s*['"]\*['"]/g,
    message: 'Unbounded populate can expose data and exhaust resources',
    remediation: 'Use an explicit relation allowlist and a bounded populate depth.',
  },
  {
    id: 'STRAPI-SUP-001', severity: 'S1', cwe: 'CWE-829', asvs: 'V13', owner: 'platform-integration-engineer',
    pattern: /submodule\s+update[^\n]*--remote/g,
    message: 'CI updates a mutable submodule ref',
    remediation: 'Build the exact submodule commit recorded by the parent repository.',
  },
  {
    id: 'STRAPI-SUP-002', severity: 'S1', cwe: 'CWE-295', asvs: 'V12', owner: 'platform-integration-engineer',
    pattern: /StrictHostKeyChecking\s*=\s*no/g,
    message: 'SSH host-key verification is disabled',
    remediation: 'Pin the deployment host key through a managed known_hosts file.',
  },
  {
    id: 'STRAPI-SEC-007', severity: 'S1', cwe: 'CWE-89', asvs: 'V5', owner: 'security-reviewer',
    pattern: /(?:\.raw|\.whereRaw|\.execute)\s*\([^\n]*(?:ctx\.|request\.|query\.|params\.)/g,
    message: 'Request-controlled data may reach a raw database query',
    remediation: 'Use parameterized query bindings and schema-validated allowlisted selectors.',
  },
  {
    id: 'STRAPI-SEC-008', severity: 'S1', cwe: 'CWE-22', asvs: 'V12', owner: 'security-reviewer',
    pattern: /(?:readFile|writeFile|createReadStream|createWriteStream|unlink)\s*\([^\n]*(?:ctx\.|request\.|query\.|params\.)/g,
    message: 'Request-controlled data may reach a filesystem path',
    remediation: 'Resolve against a fixed base directory and reject traversal after canonicalization.',
  },
  {
    id: 'STRAPI-SEC-009', severity: 'S1', cwe: 'CWE-601', asvs: 'V5', owner: 'security-reviewer',
    pattern: /(?:ctx\.)?redirect\s*\([^\n]*(?:ctx\.|request\.|query\.|params\.)/g,
    message: 'Request-controlled data may reach a redirect target',
    remediation: 'Use an allowlist of relative destinations and reject absolute or protocol-relative URLs.',
  },
  {
    id: 'STRAPI-SAN-003', severity: 'S1', cwe: 'CWE-915', asvs: 'V5', owner: 'strapi-backend-engineer',
    pattern: /(?:strapi\.documents|entityService)[\s\S]{0,180}(?:create|update)\s*\([\s\S]{0,180}data\s*:\s*(?:ctx\.)?request\.body/g,
    message: 'Raw request body may be passed to a persistence service',
    remediation: 'Validate and allowlist writable fields before passing data to Document Service.',
  },
];

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function finding(rule, file, source, index, evidence) {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    cwe: rule.cwe,
    owasp: rule.owasp ?? 'OWASP-ASVS',
    asvs: rule.asvs,
    confidence: 'high',
    owner: rule.owner,
    file,
    line: lineNumber(source, index),
    message: rule.message,
    evidence: evidence.replace(/[A-Za-z0-9_\-+/=]{24,}/g, '<redacted>').slice(0, 180),
    dataFlow: rule.dataFlow ?? 'source/sink pattern identified in the reported location',
    affected: { sourceFile: file },
    remediation: rule.remediation,
    regressionTestId: `security.${rule.id.toLowerCase()}.${file.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${lineNumber(source, index)}`,
    suppressed: false,
  };
}

function gitTracked(root, file) {
  const result = spawnSync('git', ['ls-files', '--error-unmatch', file], { cwd: root, encoding: 'utf8' });
  return result.status === 0;
}

export async function scanSecurity(projectRoot) {
  const root = path.resolve(projectRoot);
  let excluded = [];
  try {
    excluded = YAML.parse(await readFile(path.join(root, '.agents', 'security.config.yaml'), 'utf8'))?.exclude ?? [];
  } catch {
    // The default scans every supported source file.
  }
  const isExcluded = (file) => excluded.some((pattern) => pattern.endsWith('/**') ? file.startsWith(pattern.slice(0, -2)) : file === pattern);
  const files = await walk(root, (filePath) => {
    const file = normalizePath(root, filePath);
    if (isExcluded(file)) return false;
    return /\.(?:[cm]?[jt]sx?|json|ya?ml|sh|cjs|Dockerfile|env)$/i.test(filePath) || /(?:Dockerfile|Jenkinsfile)$/i.test(path.basename(filePath));
  });
  const findings = [];
  for (const filePath of files) {
    const file = normalizePath(root, filePath);
    const source = await readFile(filePath, 'utf8');
    for (const rule of RULES) {
      if (rule.predicate && !rule.predicate(source)) continue;
      rule.pattern.lastIndex = 0;
      for (const match of source.matchAll(rule.pattern)) findings.push(finding(rule, file, source, match.index, match[0]));
    }
  }

  for (const candidate of ['.env', '.env.local', '.env.production']) {
    if (gitTracked(root, candidate)) {
      findings.push({
        ruleId: 'STRAPI-SUP-003', severity: 'S1', cwe: 'CWE-798', asvs: 'V13', confidence: 'high',
        owasp: 'OWASP-ASVS', dataFlow: 'tracked credential file -> source/package/build context', affected: { sourceFile: candidate },
        owner: 'platform-integration-engineer', file: candidate, line: 1,
        message: 'Environment file is tracked by Git', evidence: '<contents redacted>',
        remediation: 'Remove the file from Git, keep a value-free example, and rotate reused credentials.',
        regressionTestId: `security.strapi-sup-003.${candidate.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.1`, suppressed: false,
      });
    }
  }

  let manifest = null;
  try {
    manifest = await discoverProject(root);
    const config = await loadTestgenConfig(root);
    const allowlist = new Set((config.publicRoutes ?? []).map((route) => `${String(route.method).toUpperCase()} ${route.path}`));
    for (const route of manifest.routes.filter((item) => item.auth === false && !isExcluded(item.source))) {
      const key = `${route.method} ${route.path}`;
      if (!allowlist.has(key)) {
        findings.push({
          ruleId: 'STRAPI-AUTH-001', severity: 'S1', cwe: 'CWE-306', asvs: 'V4', confidence: 'high',
          owasp: 'OWASP-API5', dataFlow: 'anonymous request -> Strapi route handler', affected: { route: key },
          owner: 'security-reviewer', file: route.source, line: 1,
          message: `Anonymous route is not allowlisted: ${key}`, evidence: key,
          remediation: 'Require authentication or document the route in testgen.config.yaml and add negative authorization tests.',
          regressionTestId: `security.strapi-auth-001.${key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, suppressed: false,
        });
      }
      if (route.scope === 'admin') {
        findings.push({
          ruleId: 'STRAPI-AUTH-002', severity: 'S1', cwe: 'CWE-306', asvs: 'V4', confidence: 'high',
          owasp: 'OWASP-API5', dataFlow: 'anonymous request -> admin route handler', affected: { route: key },
          owner: 'security-reviewer', file: route.source, line: 1,
          message: `Admin route disables authentication: ${key}`, evidence: key,
          remediation: 'Restore admin authentication and attach the least-privilege plugin permission.',
          regressionTestId: `security.strapi-auth-002.${key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, suppressed: false,
        });
      }
    }
  } catch {
    // A security scan still returns source findings for incomplete fixtures.
  }

  const exceptionPath = path.join(root, '.agents', 'security-exceptions.yaml');
  let exceptions = [];
  try {
    exceptions = YAML.parse(await readFile(exceptionPath, 'utf8'))?.exceptions ?? [];
  } catch {
    // Exceptions are optional; unreadable files cannot suppress a finding.
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const exception of exceptions) {
    const matches = findings.filter((item) => item.ruleId === exception.ruleId && (!exception.file || item.file === exception.file));
    for (const item of matches) {
      if (item.severity === 'S1') continue;
      if (exception.reason && exception.owner && /^\d{4}-\d{2}-\d{2}$/.test(exception.expires ?? '') && exception.expires >= today) {
        item.suppressed = true;
        item.exception = { reason: exception.reason, owner: exception.owner, expires: exception.expires };
      }
    }
  }

  const rank = { S1: 0, S2: 1, S3: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);
  const active = findings.filter((item) => !item.suppressed);
  return {
    schemaVersion: 1,
    target: root,
    summary: {
      total: active.length,
      suppressed: findings.length - active.length,
      S1: active.filter((item) => item.severity === 'S1').length,
      S2: active.filter((item) => item.severity === 'S2').length,
      S3: active.filter((item) => item.severity === 'S3').length,
    },
    findings,
    manifestDigest: manifest?.digest ?? null,
  };
}
