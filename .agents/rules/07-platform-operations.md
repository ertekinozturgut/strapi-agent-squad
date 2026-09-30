# Platform, Integrations, and Operations

- Production uses explicit database, cache, storage, proxy, secret-management, backup, restore, and data-retention contracts that fail closed.
- Outbound calls enforce allowlisted schemes/hosts, DNS rebinding and private-address defense, redirect revalidation, timeout, bounded retry/jitter, idempotency, token refresh, and redacted telemetry.
- Multi-replica deployments do not rely on process-local rate-limit, replay, lock, queue, cron-leader, or session state.
- Logs are structured and carry correlation IDs without bodies, credentials, or PII; metrics cover latency, errors, retries, queue depth, rate limits, cache outcomes, and failed side effects.
- Cache keys include tenant, locale, publication/deletion state, permissions, query shape, and schema version; invalidation occurs only after committed writes.
- Storage validates paths, MIME, extension, size, active SVG/HTML content, signed URL lifetime, encryption, bucket permissions, and cleanup.
- Health checks expose readiness/liveness only and never disclose configuration or stacks. Resource bounds, graceful drain, and dependency failure modes are tested.
- Deployment follows check → verify → build → publish → deploy with immutable artifacts, safe migrations, rollback instructions, and reconciliation for external systems.
