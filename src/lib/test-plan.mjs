import { sha256, stableValue } from './utils.mjs';

function slug(value) {
  return String(value).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function entry(id, kind, target, mode = 'static', severity = 'S2') {
  return { id, kind, target, mode, severity };
}

export function buildTestPlan(manifest, config) {
  const tests = [];
  for (const contentType of manifest.contentTypes) {
    const base = `ct.${slug(contentType.uid)}`;
    tests.push(entry(`${base}.mass-assignment`, 'mass-assignment', contentType.uid, 'runtime', 'S1'));
    tests.push(entry(`${base}.managed-fields`, 'managed-field-rejection', contentType.uid, 'runtime', 'S1'));
    tests.push(entry(`${base}.private-output`, 'private-pii-output', contentType.uid, 'static+runtime', 'S1'));
    if (contentType.options?.draftAndPublish) tests.push(entry(`${base}.draft-publish`, 'draft-publish-visibility', contentType.uid, 'runtime', 'S1'));
    if (contentType.pluginOptions?.i18n?.localized) tests.push(entry(`${base}.locale-isolation`, 'locale-isolation', contentType.uid, 'runtime', 'S1'));
    for (const [field, attribute] of Object.entries(contentType.attributes ?? {})) {
      const fieldBase = `${base}.field.${slug(field)}`;
      if (attribute.required) tests.push(entry(`${fieldBase}.required`, 'required-field', `${contentType.uid}.${field}`, 'static+runtime'));
      if (attribute.unique) tests.push(entry(`${fieldBase}.unique`, 'unique-field', `${contentType.uid}.${field}`, 'static+runtime'));
      if (attribute.type === 'enumeration') tests.push(entry(`${fieldBase}.enum`, 'enum-field', `${contentType.uid}.${field}`, 'static+runtime'));
      if (attribute.type === 'email') tests.push(entry(`${fieldBase}.email`, 'email-field', `${contentType.uid}.${field}`, 'static+runtime'));
      if (attribute.regex || attribute.min !== undefined || attribute.max !== undefined || attribute.minLength !== undefined || attribute.maxLength !== undefined) {
        tests.push(entry(`${fieldBase}.bounds`, 'field-bounds', `${contentType.uid}.${field}`, 'static+runtime'));
      }
      if (attribute.type === 'relation') tests.push(entry(`${fieldBase}.relation`, 'relation-integrity', `${contentType.uid}.${field}`));
      if (attribute.type === 'component' || attribute.type === 'dynamiczone') tests.push(entry(`${fieldBase}.component`, 'component-integrity', `${contentType.uid}.${field}`));
      if (attribute.type === 'media') tests.push(entry(`${fieldBase}.media`, 'media-type-size-mime', `${contentType.uid}.${field}`, 'runtime', 'S1'));
    }
  }

  for (const route of manifest.routes) {
    const base = `route.${slug(`${route.method}-${route.path}`)}`;
    tests.push(entry(`${base}.definition`, 'route-definition-order-handler', `${route.method} ${route.path}`));
    tests.push(entry(`${base}.error-contract`, 'error-status-and-redaction', `${route.method} ${route.path}`, 'runtime', 'S1'));
    for (const identity of config.identities ?? []) {
      tests.push(entry(`${base}.identity.${slug(identity.name)}`, 'auth-permission-matrix', `${route.method} ${route.path}:${identity.name}`, 'runtime', 'S1'));
    }
  }

  for (const plugin of manifest.plugins) {
    const base = `plugin.${slug(plugin)}`;
    tests.push(entry(`${base}.lifecycle-idempotency`, 'plugin-lifecycle-idempotency', plugin, 'runtime'));
    tests.push(entry(`${base}.exports`, 'plugin-export-integrity', plugin));
    tests.push(entry(`${base}.permissions`, 'plugin-admin-rbac', plugin, 'static+runtime', 'S1'));
    tests.push(entry(`${base}.admin-ui`, 'admin-ui-validation-a11y-xss', plugin, 'runtime', 'S1'));
  }

  if (manifest.features.mcp) {
    for (const kind of ['input-schema', 'ability-session', 'record-field-authorization', 'draft-locale-delete', 'history-pii', 'oauth']) {
      tests.push(entry(`mcp.${kind}`, `mcp-${kind}`, 'MCP', 'static+runtime', 'S1'));
    }
  }
  if (manifest.features.webhooks) tests.push(entry('integration.webhook', 'webhook-signature-replay', 'webhooks', 'runtime', 'S1'));
  tests.push(entry('integration.network-isolation', 'deny-real-network', 'test-runtime', 'runtime', 'S1'));
  for (const service of config.externalServices ?? []) {
    tests.push(entry(`integration.${slug(service.name ?? service.host)}.resilience`, 'timeout-retry-idempotency-token-refresh', service.host ?? service.name, 'runtime', 'S1'));
  }

  const sorted = tests.sort((a, b) => a.id.localeCompare(b.id));
  return stableValue({
    schemaVersion: 1,
    digest: sha256(JSON.stringify(sorted)),
    tests: sorted,
    counts: {
      total: sorted.length,
      static: sorted.filter((test) => test.mode.includes('static')).length,
      runtime: sorted.filter((test) => test.mode.includes('runtime')).length,
      S1: sorted.filter((test) => test.severity === 'S1').length,
    },
  });
}
