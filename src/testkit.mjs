export function duplicateRoutes(routes) {
  const seen = new Set();
  return routes.filter((route) => {
    const key = `${route.scope}:${route.method}:${route.path}`;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}

export function missingComponentReferences(contentTypes, components) {
  const known = new Set(components.map((component) => component.uid));
  const missing = [];
  for (const contentType of contentTypes) {
    for (const [field, attribute] of Object.entries(contentType.attributes ?? {})) {
      if (attribute.type === 'component' && !known.has(attribute.component)) {
        missing.push(`${contentType.uid}.${field} -> ${attribute.component}`);
      }
      if (attribute.type === 'dynamiczone') {
        for (const component of attribute.components ?? []) {
          if (!known.has(component)) missing.push(`${contentType.uid}.${field} -> ${component}`);
        }
      }
    }
  }
  return missing;
}

export function missingRelationTargets(contentTypes) {
  const known = new Set(contentTypes.map((contentType) => contentType.uid));
  const missing = [];
  for (const contentType of contentTypes) {
    for (const [field, attribute] of Object.entries(contentType.attributes ?? {})) {
      if (attribute.type === 'relation' && typeof attribute.target === 'string' && attribute.target.startsWith('api::') && !known.has(attribute.target)) {
        missing.push(`${contentType.uid}.${field} -> ${attribute.target}`);
      }
    }
  }
  return missing;
}

export function schemaContractViolations(contentTypes) {
  const findings = [];
  for (const contentType of contentTypes) {
    const seen = new Set();
    for (const [field, attribute] of Object.entries(contentType.attributes ?? {})) {
      if (seen.has(field)) findings.push(`${contentType.uid} has duplicate field ${field}`);
      seen.add(field);
      if (attribute.type === 'enumeration' && (!Array.isArray(attribute.enum) || attribute.enum.length === 0)) {
        findings.push(`${contentType.uid}.${field} has an empty enumeration`);
      }
      if (attribute.required === true && attribute.default === null) {
        findings.push(`${contentType.uid}.${field} is required but defaults to null`);
      }
    }
  }
  return findings;
}

export function unsafePrivateFields(contentTypes, piiFields) {
  const byUid = new Map(contentTypes.map((contentType) => [contentType.uid, contentType]));
  const findings = [];
  for (const key of piiFields) {
    const separator = key.lastIndexOf('.');
    const uid = key.slice(0, separator);
    const field = key.slice(separator + 1);
    const attribute = byUid.get(uid)?.attributes?.[field];
    if (!attribute) findings.push(`${key} does not exist`);
    else if (attribute.private !== true) findings.push(`${key} is not private`);
  }
  return findings;
}

export function plannedSchemaViolations(contentTypes, plannedTests) {
  const byUid = new Map(contentTypes.map((contentType) => [contentType.uid, contentType]));
  const violations = [];
  for (const item of plannedTests.filter((test) => test.mode.includes('static') && test.target.includes('.'))) {
    const separator = item.target.lastIndexOf('.');
    const uid = item.target.slice(0, separator);
    const field = item.target.slice(separator + 1);
    const attribute = byUid.get(uid)?.attributes?.[field];
    if (!attribute) {
      if (item.kind !== 'private-pii-output') violations.push(`${item.id}: ${item.target} no longer exists`);
      continue;
    }
    if (item.kind === 'required-field' && attribute.required !== true) violations.push(`${item.id}: required contract drifted`);
    if (item.kind === 'unique-field' && attribute.unique !== true) violations.push(`${item.id}: unique contract drifted`);
    if (item.kind === 'enum-field' && (!Array.isArray(attribute.enum) || attribute.enum.length === 0)) violations.push(`${item.id}: enum contract is empty`);
    if (item.kind === 'email-field' && attribute.type !== 'email') violations.push(`${item.id}: email contract drifted`);
  }
  return violations;
}

export function assertLoopbackUrl(value) {
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error(`Runtime tests may only target loopback hosts, received ${url.hostname}`);
  }
  return url;
}

export function createIsolatedFetch(fetchImpl = globalThis.fetch) {
  return (input, init) => {
    assertLoopbackUrl(input instanceof URL ? input : new URL(input));
    return fetchImpl(input, init);
  };
}
