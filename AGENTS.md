# Strapi Agent Squad

Read `.agents/INIT.md`, then apply every rule in `.agents/rules/` and the role guide matching the current handoff in `.agents/skills/`.

The canonical state is `tasks.json`. Keep WIP at one, do not mark a task ready without the declared content, permission, migration, test, security, rollout, and rollback artifacts, and do not complete a task while an S1 finding remains.

Run `strapi-squad doctor`, `strapi-squad testgen --check`, and `strapi-squad check` before handing work to review.
