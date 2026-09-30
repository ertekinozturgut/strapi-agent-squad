# Generated Tests and Supply Chain

- Generated tests stay in `tests/generated`; handwritten tests stay in `tests/handwritten`. Run `testgen --check` in CI and never overwrite human-authored files.
- Generation is deterministic, idempotent, source-hashed, and free of timestamps. Never emit skipped tests to hide missing intent; missing S1 configuration blocks.
- Each S1 rule has positive, negative, and boundary fixtures. Unit tests never call live services; runtime tests use disposable databases, synthetic data, loopback hosts, and network denial.
- Fast suites use SQLite; release evidence includes PostgreSQL parity for constraints, transactions, JSON, ordering, concurrency, and migrations.
- Frozen lockfile installation, worktree/history/artifact secret scanning, dependency audit, SBOM, license policy, and Trivy are release requirements.
- Submodules, CI actions, and external scripts are pinned to immutable commits. Build contexts and artifacts must not contain `.env`, `.git`, SSH keys, or tokens.
- SARIF/JSON/Markdown reports redact evidence and preserve rule ID, severity, standards, location, flow, confidence, affected asset, owner, remediation, and regression test ID.
