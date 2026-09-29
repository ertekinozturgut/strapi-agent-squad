# Strapi Architecture and Plugin Boundaries

- Target Strapi 5 and TypeScript. Application data uses Document Service; legacy Entity Service requires an explicit migration task.
- Keep Content API, Admin API, plugin server, plugin admin, MCP, and integration boundaries explicit in imports, routes, permissions, and tests.
- Controllers orchestrate HTTP concerns, services own business rules, policies authorize, and middlewares handle transport concerns. No layer silently assumes another authorized the request.
- Plugin `register`, `bootstrap`, `destroy`, routes, controllers, services, policies, permissions, cron, lifecycles, and Document Service middleware form one coherent public contract and are idempotent.
- Admin code never imports secrets or server-only modules; server code never depends on browser globals. Shared code contains pure types and validation.
- Cross-plugin access uses documented services/contracts, not database tables, private filesystem imports, or internal implementation details.
- Core route overrides and route ordering are reviewed because a broad parameter route can shadow a specific route.
- Generated Strapi types are outputs; never edit them manually. Dynamic route, UID, populate, field, filter, and sort construction requires allowlists and tests.
