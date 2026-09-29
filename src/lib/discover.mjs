import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { SOURCE_EXTENSIONS, detectPackageManager, hashFile, normalizePath, readJson, sha256, stableValue, walk } from './utils.mjs';

const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

function propertyName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return null;
}

function literalValue(node) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  if (ts.isObjectLiteralExpression(node)) {
    const value = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = propertyName(property.name);
      if (name) value[name] = literalValue(property.initializer);
    }
    return value;
  }
  return { dynamic: node.getText().slice(0, 160) };
}

function routeFromObject(node, scope, file) {
  const data = {};
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyName(property.name);
    if (name) data[name] = literalValue(property.initializer);
  }
  if (typeof data.method !== 'string' || typeof data.path !== 'string') return null;
  const config = data.config && typeof data.config === 'object' && !Array.isArray(data.config) ? data.config : {};
  return {
    method: data.method.toUpperCase(),
    path: data.path,
    handler: typeof data.handler === 'string' ? data.handler : data.handler?.dynamic ?? null,
    scope,
    auth: config.auth ?? 'strapi-default',
    policies: Array.isArray(config.policies) ? config.policies : [],
    middlewares: Array.isArray(config.middlewares) ? config.middlewares : [],
    source: file,
  };
}

function inspectRoutes(sourceText, file) {
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const routes = [];
  const coreRouters = [];
  const dynamic = [];

  function visit(node, scope = file.includes('/plugins/') ? 'plugin' : 'content-api') {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      if (node.expression.name.text === 'createCoreRouter') {
        const uid = literalValue(node.arguments[0]);
        coreRouters.push({ uid: typeof uid === 'string' ? uid : null, source: file });
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      const nextScope = name === 'admin' || name === 'content-api' ? name : scope;
      if (name === 'routes' && ts.isArrayLiteralExpression(node.initializer)) {
        for (const element of node.initializer.elements) {
          if (!ts.isObjectLiteralExpression(element)) {
            dynamic.push({ source: file, expression: element.getText().slice(0, 160) });
            continue;
          }
          const route = routeFromObject(element, scope, file);
          if (route) routes.push(route);
        }
      }
      ts.forEachChild(node.initializer, (child) => visit(child, nextScope));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, scope));
  }

  visit(sourceFile);
  return { routes, coreRouters, dynamic };
}

function inspectSourceFeatures(sourceText, file) {
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const usages = { documentService: [], outboundHttp: [], mcpDefinitions: [], lifecycleHandlers: [] };
  const lifecycleNames = new Set(['beforeCreate', 'afterCreate', 'beforeUpdate', 'afterUpdate', 'beforeDelete', 'afterDelete', 'beforeFindMany', 'afterFindMany']);

  function record(collection, node, expression) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    collection.push({ source: file, line: position.line + 1, expression: expression.slice(0, 160) });
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sourceFile);
      if (/(?:^|\.)documents$/.test(callee)) record(usages.documentService, node, node.getText(sourceFile));
      if (callee === 'fetch' || /(?:^|\.)(?:get|post|put|patch|delete|request)$/.test(callee) && /axios|http|client/i.test(callee)) {
        record(usages.outboundHttp, node, node.getText(sourceFile));
      }
      if (/(?:registerTool|registerResource|registerPrompt|\.tool|\.resource|\.prompt)$/.test(callee)) {
        record(usages.mcpDefinitions, node, node.getText(sourceFile));
      }
    }
    if ((ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node)) && lifecycleNames.has(propertyName(node.name))) {
      record(usages.lifecycleHandlers, node, node.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return usages;
}

function surfaceInventory(files) {
  const matching = (pattern) => files.filter((file) => pattern.test(file)).sort();
  return {
    controllers: matching(/\/(?:controllers?)\//),
    services: matching(/\/(?:services?)\//),
    policies: matching(/\/(?:policies?)\//),
    middlewares: matching(/\/(?:middlewares?)\//),
    lifecycles: matching(/(?:^|\/)lifecycles?\.[cm]?[jt]s$/),
    pluginAdmin: matching(/^src\/plugins\/[^/]+\/admin\//),
    pluginServer: matching(/^src\/plugins\/[^/]+\/server\//),
    cron: matching(/(?:^|\/)(?:cron|tasks)\//i),
    ci: matching(/^(?:\.github\/workflows\/|azure-pipelines|Jenkinsfile)/),
  };
}

function contentTypeUid(file, schema) {
  const normalized = file.split(path.sep).join('/');
  const plugin = normalized.match(/src\/plugins\/([^/]+)\/server\/src\/content-types\/([^/]+)\/schema\.json$/);
  if (plugin) return `plugin::${plugin[1]}.${schema.info?.singularName ?? plugin[2]}`;
  const api = normalized.match(/src\/api\/([^/]+)\/content-types\/([^/]+)\/schema\.json$/);
  if (api) return `api::${api[1]}.${schema.info?.singularName ?? api[2]}`;
  return `unknown::${schema.info?.singularName ?? path.basename(path.dirname(file))}`;
}

function featureInventory(files) {
  const has = (fragment) => files.some((file) => file.includes(fragment.replace(/^\//, '')));
  return {
    adminCustomization: has('src/admin/') || has('admin/src/'),
    localPlugins: has('src/plugins/'),
    mcp: files.some((file) => /(^|\/)mcp(\/|\.|-)/i.test(file)),
    migrations: has('database/migrations/'),
    webhooks: files.some((file) => /webhook/i.test(file)),
    cron: files.some((file) => /cron/i.test(file)),
  };
}

export async function discoverProject(projectRoot) {
  const root = path.resolve(projectRoot);
  const packagePath = path.join(root, 'package.json');
  let packageJson;
  try {
    packageJson = await readJson(packagePath);
  } catch {
    throw new Error(`No readable package.json found in ${root}`);
  }

  const strapiVersion = packageJson.dependencies?.['@strapi/strapi'] ?? packageJson.devDependencies?.['@strapi/strapi'] ?? null;
  const files = await walk(root, (file) => {
    const relative = normalizePath(root, file);
    if (relative.startsWith('.agents/generated/') || relative.startsWith('.agents/reports/') || relative.startsWith('tests/generated/')) return false;
    return SOURCE_EXTENSIONS.has(path.extname(file)) || relative === 'package.json' || relative.endsWith('.yaml') || relative.endsWith('.yml');
  });
  const relativeFiles = files.map((file) => normalizePath(root, file));
  const schemaFiles = files.filter((file) => {
    const segments = normalizePath(root, file).split('/');
    return segments.length >= 3 && segments.at(-1) === 'schema.json' && segments.at(-3) === 'content-types';
  });
  const componentFiles = files.filter((file) => {
    const relative = normalizePath(root, file);
    return relative.startsWith('src/components/') && path.extname(relative) === '.json';
  });
  const routeFiles = files.filter((file) => CODE_EXTENSIONS.has(path.extname(file)) && normalizePath(root, file).includes('/routes/'));

  const contentTypes = [];
  for (const file of schemaFiles) {
    const schema = await readJson(file);
    contentTypes.push({
      uid: contentTypeUid(file, schema),
      kind: schema.kind,
      collectionName: schema.collectionName ?? null,
      info: schema.info ?? {},
      options: schema.options ?? {},
      pluginOptions: schema.pluginOptions ?? {},
      attributes: schema.attributes ?? {},
      source: normalizePath(root, file),
    });
  }

  const components = [];
  for (const file of componentFiles) {
    const schema = await readJson(file);
    const match = normalizePath(root, file).match(/^src\/components\/([^/]+)\/([^/]+)\.json$/);
    components.push({
      uid: match ? `${match[1]}.${match[2]}` : normalizePath(root, file),
      attributes: schema.attributes ?? {},
      source: normalizePath(root, file),
    });
  }

  const routes = [];
  const coreRouters = [];
  const dynamicRoutes = [];
  const usages = { documentService: [], outboundHttp: [], mcpDefinitions: [], lifecycleHandlers: [] };
  for (const file of routeFiles) {
    const relative = normalizePath(root, file);
    const inspected = inspectRoutes(await readFile(file, 'utf8'), relative);
    routes.push(...inspected.routes);
    coreRouters.push(...inspected.coreRouters);
    dynamicRoutes.push(...inspected.dynamic);
  }

  for (const file of files.filter((item) => CODE_EXTENSIONS.has(path.extname(item)))) {
    const relative = normalizePath(root, file);
    const inspected = inspectSourceFeatures(await readFile(file, 'utf8'), relative);
    for (const key of Object.keys(usages)) usages[key].push(...inspected[key]);
  }

  const sourceHashes = {};
  for (const file of files) sourceHashes[normalizePath(root, file)] = await hashFile(file);
  const plugins = [...new Set(relativeFiles.map((file) => file.match(/^src\/plugins\/([^/]+)/)?.[1]).filter(Boolean))].sort();
  const piiCandidates = [];
  const piiPattern = /^(email|phone|phoneNumber|firstName|lastName|fullName|address|birthDate|plate|vin|iban|tckn|vkn)$/i;
  for (const contentType of contentTypes) {
    for (const [field, attribute] of Object.entries(contentType.attributes)) {
      if (piiPattern.test(field)) piiCandidates.push({ uid: contentType.uid, field, private: attribute.private === true });
    }
  }

  const dependencyNames = new Set([...Object.keys(packageJson.dependencies ?? {}), ...Object.keys(packageJson.devDependencies ?? {})]);
  const baseFeatures = featureInventory(relativeFiles);
  const features = {
    ...baseFeatures,
    mcp: baseFeatures.mcp || usages.mcpDefinitions.length > 0,
    graphql: dependencyNames.has('@strapi/plugin-graphql'),
    i18n: dependencyNames.has('@strapi/plugin-i18n') || contentTypes.some((item) => item.pluginOptions?.i18n?.localized),
    database: relativeFiles.some((file) => /(?:^|\/)config\/database\.[cm]?[jt]s$/.test(file)),
    cache: relativeFiles.some((file) => /cache/i.test(file)),
    storage: relativeFiles.some((file) => /upload|storage|s3|cloudinary/i.test(file)),
  };

  const manifest = {
    schemaVersion: 1,
    project: {
      name: packageJson.name ?? path.basename(root),
      strapiVersion,
      typescript: relativeFiles.includes('tsconfig.json'),
      packageManager: await detectPackageManager(root),
    },
    contentTypes: contentTypes.sort((a, b) => a.uid.localeCompare(b.uid)),
    components: components.sort((a, b) => a.uid.localeCompare(b.uid)),
    routes: routes.sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`)),
    coreRouters: coreRouters.sort((a, b) => String(a.uid).localeCompare(String(b.uid))),
    dynamicRoutes,
    plugins,
    surfaces: surfaceInventory(relativeFiles),
    usages: stableValue(usages),
    features,
    piiCandidates: piiCandidates.sort((a, b) => `${a.uid}.${a.field}`.localeCompare(`${b.uid}.${b.field}`)),
    sourceHashes: stableValue(sourceHashes),
  };
  manifest.digest = sha256(JSON.stringify(stableValue(manifest)));
  return manifest;
}
