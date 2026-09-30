# Admin Panel and Editor UX

- Protect every plugin page, route, menu entry, and action with registered Strapi admin permissions plus `Page.Protect` or its supported equivalent; hiding a button is not authorization.
- Server-side checks remain mandatory. Read, create, update, publish, delete, restore, export, and configuration permissions stay separate and receive role-matrix tests.
- Use Strapi Design System components/tokens before custom primitives and preserve loading, disabled, error, empty, success, cancellation, stale-data, and focus states.
- Forms prevent duplicate submission, retain valid input after errors, map field/server errors safely, and confirm destructive or irreversible actions.
- Render untrusted content safely; HTML previews need sanitization and tests for stored XSS, unsafe URLs, SVG scripts, and sandbox escape.
- All translation keys exist for supported locales. Keyboard navigation, focus order/restoration, labels, accessible names, contrast, and live announcements are required.
- Error UI never displays raw response bodies, stack traces, internal identifiers, credentials, or PII.
