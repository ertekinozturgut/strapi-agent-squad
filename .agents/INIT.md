# Strapi Agent Squad — Initialization

This repository is the canonical Strapi 5 + TypeScript squad. Install it into a target project with:

```bash
pnpm dlx github:ertekinozturgut/strapi-agent-squad init --target . --write
pnpm install
pnpm squad:doctor
```

The initializer never overwrites an existing file. Resolve reported conflicts deliberately, complete `.agents/testgen.config.yaml`, then generate and verify tests:

```bash
pnpm squad:testgen
pnpm squad:check
```

No work starts until `doctor` confirms Strapi 5, TypeScript, a lockfile, and a complete security/test contract. Generated files live only under `tests/generated/` and `.agents/generated/`; handwritten tests live under `tests/handwritten/`.

The task state machine is `pending -> in_progress -> in_review -> completed`, with `blocked` and `changes_requested` as explicit exceptional states. WIP is one. S1 findings cannot be suppressed; S2 suppressions need an owner, reason, scope, and expiry.
