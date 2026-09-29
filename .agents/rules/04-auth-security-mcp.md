# Authentication, Authorization, Sanitization, PII, and MCP

- `auth: false` is forbidden unless the exact method/path is allowlisted.
- Test anonymous, authenticated, API-token, admin-token, plugin permission, record ownership, and field visibility independently.
- Custom controllers validate and sanitize query/input/output with the correct content-type schema.
- Admin tokens and Content API tokens are not interchangeable.
- MCP tools apply the same type, record, field, draft, locale, and deletion rules as REST.
- Secrets fail closed in production and never enter source, logs, responses, reports, images, or artifacts.
- Outbound URLs, redirects, callbacks, uploads, HTML, and shell/process operations require explicit allowlists and negative tests.
- Authorization order is action/type, record ownership, field visibility, publication/deletion state, and locale; a broad plugin permission never implies unrestricted content access.
- Public write-only endpoints prove read, update, delete, populate, filter, and identifier-enumeration surfaces stay closed.
- OAuth uses exact redirect URI and audience, expiring one-use state/CSRF/code values, PKCE where applicable, refresh-token rotation, and replay detection.
- MCP tool/resource/prompt inputs use strict schemas. History, revision, dump, and search results pass the same output sanitization and PII rules as REST.
- Responses distinguish 401, 403, 404, 409, 422, and 429 without leaking existence, stacks, credentials, internal queries, or restricted values.
- Webhooks verify signature, freshness, replay, bounded bodies, and idempotency. Forwarded client IP headers are trusted only from proven proxies.
