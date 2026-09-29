import path from 'node:path';
import { writeDeterministic, stableStringify } from './utils.mjs';

function markdown(report) {
  const lines = [
    '# Strapi Agent Squad Security Report',
    '',
    `- S1: ${report.summary.S1}`,
    `- S2: ${report.summary.S2}`,
    `- S3: ${report.summary.S3}`,
    `- Suppressed S2/S3: ${report.summary.suppressed ?? 0}`,
    '',
  ];
  for (const finding of report.findings) {
    lines.push(`## ${finding.severity} ${finding.ruleId}: ${finding.message}`);
    lines.push('');
    lines.push(`- Location: \`${finding.file}:${finding.line}\``);
    lines.push(`- Standards: ${finding.cwe}, ASVS ${finding.asvs}`);
    lines.push(`- OWASP: ${finding.owasp}`);
    lines.push(`- Confidence: ${finding.confidence}`);
    lines.push(`- Data flow: ${finding.dataFlow}`);
    lines.push(`- Owner: ${finding.owner}`);
    lines.push(`- Regression test: ${finding.regressionTestId}`);
    if (finding.suppressed) lines.push(`- Exception: ${finding.exception.reason} (owner: ${finding.exception.owner}, expires: ${finding.exception.expires})`);
    lines.push(`- Remediation: ${finding.remediation}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function sarif(report) {
  const rules = [...new Map(report.findings.map((finding) => [finding.ruleId, finding])).values()];
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: 'strapi-agent-squad',
          rules: rules.map((rule) => ({
            id: rule.ruleId,
            shortDescription: { text: rule.message },
            help: { text: rule.remediation },
            properties: { securitySeverity: rule.severity, tags: [rule.cwe, `ASVS-${rule.asvs}`] },
          })),
        },
      },
      results: report.findings.filter((finding) => !finding.suppressed).map((finding) => ({
        ruleId: finding.ruleId,
        level: finding.severity === 'S1' ? 'error' : finding.severity === 'S2' ? 'warning' : 'note',
        message: { text: finding.message },
        locations: [{ physicalLocation: { artifactLocation: { uri: finding.file }, region: { startLine: finding.line } } }],
      })),
    }],
  };
}

export async function writeSecurityReports(root, report) {
  const directory = path.join(root, '.agents', 'reports');
  await writeDeterministic(path.join(directory, 'security-report.json'), stableStringify(report));
  await writeDeterministic(path.join(directory, 'security-report.md'), markdown(report));
  await writeDeterministic(path.join(directory, 'security-report.sarif'), stableStringify(sarif(report)));
  return directory;
}
