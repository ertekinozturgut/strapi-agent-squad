# Automatic Test Generation

## Pipeline

1. `doctor` validates Strapi 5, TypeScript, lockfile, and test contract.
2. `discover` parses schemas and TypeScript route ASTs, inventories plugins and features, and hashes relevant sources.
3. `testgen.config.yaml` supplies intent that code cannot prove: public routes, PII, ownership, roles, external hosts, and state machines.
4. `testgen --write` emits deterministic tests and a manifest.
5. `testgen --check` regenerates in memory and blocks stale output.
6. Runtime suites use an isolated loopback Strapi instance and never connect to development or production data.

The generator emits executable schema/reference and route-security contracts plus a stable-ID test plan for Draft & Publish, i18n, plugin RBAC, MCP, upload, migration, and integration cases. Static schema cases run immediately. Runtime route cases are emitted only when `runtime.enabled` is true and each call is explicitly declared in `routeExpectations`; non-loopback targets are a blocking configuration error.

Missing S1 intent is a configuration error, not a skipped test. Output uses stable ordering and contains no timestamps. Generated files are disposable and confined to `tests/generated/` and `.agents/generated/`; handwritten business assertions under `tests/handwritten/` are never touched.
