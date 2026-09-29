import { checkCommand, discoverCommand, doctorCommand, initCommand, reportCommand, securityCommand, testgenCommand } from './lib/commands.mjs';
import { parseOptions } from './lib/utils.mjs';

const HELP = `strapi-agent-squad\n\nCommands:\n  init --target <path> [--write]\n  doctor [--target <path>]\n  discover [--target <path>] [--write]\n  testgen [--target <path>] (--write|--check)\n  check [--target <path>]\n  verify [--target <path>]\n  security [--target <path>] [--write]\n  report [--target <path>]\n`;

export async function runCli(args) {
  const [command, ...rest] = args;
  const options = parseOptions(rest);
  switch (command) {
    case 'init': return initCommand(options);
    case 'doctor': return doctorCommand(options);
    case 'discover': return discoverCommand(options);
    case 'testgen': {
      if (!options.write && !options.check) throw Object.assign(new Error('testgen requires --write or --check'), { exitCode: 2 });
      return testgenCommand(options);
    }
    case 'check': return checkCommand(options, false);
    case 'verify': return checkCommand(options, true);
    case 'security': return securityCommand(options);
    case 'report': return reportCommand(options);
    case '--help':
    case '-h':
    case undefined:
      process.stdout.write(HELP);
      return;
    default:
      throw Object.assign(new Error(`Unknown command: ${command}\n\n${HELP}`), { exitCode: 2 });
  }
}
