# Security Analysis

The fast built-in scanner is always available. It normalizes findings and produces JSON, Markdown, and SARIF. Semgrep adds Strapi syntax rules, CodeQL provides JavaScript/TypeScript data flow, Gitleaks scans secrets, OSV/package-manager audits dependencies, Syft produces an SBOM, and Trivy scans images and configuration.

Trust boundaries include Koa requests, GraphQL arguments, uploads, webhooks, MCP inputs, imports, admin API calls, and environment-backed configuration. Critical sinks include database/raw queries, shell/process execution, filesystem paths, outbound URLs, redirects, HTML, logs, API/MCP responses, and dynamic Document Service selectors.

S1 covers exploitable authorization, injection, secret, private-data, and supply-chain failures. S2 covers reliability and defense-in-depth risks such as missing timeouts and unbounded population. S3 is advisory.

Every normalized finding includes rule ID, severity, CWE, OWASP/ASVS mapping, location, data flow, confidence, affected asset, remediation owner, and a stable regression-test ID. S1 cannot be suppressed. S2/S3 suppressions are read from `.agents/security-exceptions.yaml` and apply only when reason, owner, and a non-expired ISO date are present.
