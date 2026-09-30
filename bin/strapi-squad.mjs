#!/usr/bin/env node

import { runCli } from '../src/cli.mjs';

runCli(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`strapi-squad: ${message}\n`);
  process.exitCode = error?.exitCode ?? 2;
});
