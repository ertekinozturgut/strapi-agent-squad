import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

export async function unsafe(ctx, strapi) {
  const password = 'synthetic_fixture_password_123';
  execSync(ctx.query.command);
  await readFile(ctx.params.filename);
  await strapi.db.connection.whereRaw(ctx.query.where);
  await strapi.documents('api::lead.lead').create({ data: ctx.request.body });
  ctx.redirect(ctx.query.next);
  return password;
}
