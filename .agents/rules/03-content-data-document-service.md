# Content, Data, and Document Service

- Every schema change records compatibility, Draft & Publish, i18n, relation, component, dynamic-zone, private-field, retention, cache/search, index/constraint, API, and migration impact.
- Required, unique, enum, email, regex, min/max, private, relation, component, dynamic-zone, and media contracts receive positive, negative, and boundary tests.
- Never pass raw body, query, filters, fields, populate, locale, status, or document IDs to persistence. Validate an allowlisted command and construct Document Service parameters explicitly.
- Managed identifiers, timestamps, publication state, ownership, creator/updater, audit, and integration status fields remain server-controlled and get mass-assignment tests.
- PII fields are declared in `testgen.config.yaml`, minimized, redacted, and excluded from public output unless explicitly required.
- Lifecycle and Document Service middleware side effects are idempotent, transaction-aware, retry-safe, bounded, and observable; external side effects use an outbox or equivalent replay-safe boundary.
- Soft delete, restore, revision history, publishing, scheduling, and locale behavior are explicit state machines with conflict and audit contracts.
- Imports validate byte size, MIME/extension, encoding, formulas, XML entities, archive expansion, relation integrity, and partial-failure behavior. Migrations are tested on representative data with rollback or roll-forward evidence.
