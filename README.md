# Strapi Agent Squad

An eight-role engineering squad for analyzing and developing Strapi 5 TypeScript projects. It discovers content models, routes, plugins, admin surfaces, MCP tools, and integrations; generates deterministic contract tests; and enforces Strapi-specific security gates.

This repository preserves the history of `agent-squad` while replacing its .NET/Razor implementation with Strapi tooling.

## Install into a Strapi project

```bash
pnpm dlx github:ertekinozturgut/strapi-agent-squad init --target . --write
pnpm install
pnpm squad:doctor
```

The initializer is conservative: existing files are reported as conflicts and never overwritten. Complete `.agents/testgen.config.yaml` before generating tests.

```bash
pnpm squad:discover
pnpm squad:testgen
pnpm squad:check
```

## Commands

| Command | Purpose |
| --- | --- |
| `init --target . [--write]` | Preview or apply the squad to a Strapi 5 TypeScript project |
| `doctor` | Validate Strapi, TypeScript, lockfile, and security-test contract |
| `discover` | Inventory schemas, routes, plugins, MCP, integrations, and source hashes |
| `testgen --write` | Generate deterministic contract and route security tests |
| `testgen --check` | Fail when generated tests or the manifest drift |
| `check` | Run generation drift, security, and available typecheck/lint/test scripts |
| `verify` | Add the target build to the full check |
| `security` | Produce normalized Strapi security findings |
| `report` | Write JSON, Markdown, and SARIF security reports |

Exit codes are `0` for success, `1` for findings or stale output, and `2` for missing/invalid configuration.

## What test generation covers

- Content type and component integrity, required/enum/private/PII contracts, relations, and dynamic zones.
- Static route uniqueness, handler resolution, anonymous-route allowlisting, and admin authentication invariants.
- A stable-ID test plan for role matrices, mass assignment, BOLA/IDOR, Draft & Publish, i18n, plugin permissions, admin RBAC, MCP field/record filtering, uploads, webhooks, and integrations.
- Opt-in executable runtime tests for explicitly declared route expectations; runtime targets are hard-limited to loopback addresses.
- Missing security intent blocks generation instead of emitting skipped tests or accepting the current behavior as correct.

Generated files live under `tests/generated/` and `.agents/generated/`. Handwritten business assertions remain under `tests/handwritten/`.

## Security pipeline

The built-in fast scanner detects public route drift, dynamic execution, command injection patterns, credential logging, hard-coded secrets, unbounded populate, timeout-free outbound calls, mutable submodules, disabled SSH host verification, and tracked environment files. Semgrep rules provide Strapi-aware SAST, CodeQL uses the JavaScript security-extended suite, and CI templates add Gitleaks, OSV, SBOM, and Trivy gates.

Every finding contains a stable rule ID, S1/S2/S3 severity, CWE/OWASP/ASVS mapping, location, data flow, confidence, affected asset, owner, redacted evidence, remediation, and a regression-test ID. S1 findings cannot be suppressed; S2/S3 exceptions require a reason, owner, and expiry date.

## Squad

The canonical workflow, roles, and rules live in `.agents/`. `AGENTS.md`, `CLAUDE.md`, and Cursor rules are thin adapters to that shared source. Work is tracked in `tasks.json` with WIP=1 and evidence-backed DoR/DoD gates.

## Development

```bash
pnpm install
pnpm check
pnpm verify
```

The repository includes secure, vulnerable, and edge fixtures to prove each blocking rule catches violations without turning boundary cases into false positives.
