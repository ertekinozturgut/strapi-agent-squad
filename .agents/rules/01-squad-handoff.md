# Squad Handoff and Quality Gates

- WIP is one active or changes-requested task per squad. Ownership changes only through a recorded handoff in `tasks.json`; hidden parallel work is not valid progress.
- Definition of Ready requires acceptance criteria, affected Strapi surfaces, content/data contract, permission matrix, PII decisions, migration impact, test plan, deployment risk, and rollback.
- Definition of Done requires implementation, deterministic generated tests, handwritten business assertions, security evidence, documentation, observability, rollback evidence, and independent review.
- Handoff order is PM → analyst → architect → backend/admin/platform engineers → QA and security → PM closure. A handoff lists changed files, commands, evidence, open decisions, limitations, and the next accountable role.
- S1 blocks build and merge with no exception. S2 blocks unless an exact-scope suppression has reason, owner, compensating control, and expiry. S3 is advisory and tracked.
- A reviewer cannot approve their own implementation evidence. Security owns S1 disposition; QA owns reproducibility and regression evidence.
- A failed gate returns the task to `changes_requested`; a missing dependency or product decision uses `blocked`. Neither state can be represented as completed.
