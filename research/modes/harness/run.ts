import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CANDIDATES, getCandidate } from './registry.ts';
import { renderReport } from './report.ts';
import { simulate } from './simulate.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = resolve(HERE, '..', 'reports');

interface Args {
  candidate: string;
  seeds: number;
  seedOffset: number;
  out?: string;
  quiet: boolean;
}

function usage(): string {
  const ids = CANDIDATES.map((candidate) => `  ${candidate.id.padEnd(16)} ${candidate.description}`);
  return [
    'Usage: npm run sim -- --candidate <id> [--seeds <n>] [--seed-offset <n>] [--out <path>]',
    '',
    'Registered candidates:',
    ...ids,
  ].join('\n');
}

function parseArgs(argv: string[]): Args {
  const args: Args = { candidate: '', seeds: 1000, seedOffset: 1, quiet: false };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case '--candidate':
        args.candidate = value ?? '';
        i++;
        break;
      case '--seeds':
        args.seeds = Number(value);
        i++;
        break;
      case '--seed-offset':
        args.seedOffset = Number(value);
        i++;
        break;
      case '--out':
        args.out = value;
        i++;
        break;
      case '--quiet':
        args.quiet = true;
        break;
      case '--list':
        process.stdout.write(`${usage()}\n`);
        process.exit(0);
        break;
      default:
        throw new Error(`unrecognised argument "${flag}"\n\n${usage()}`);
    }
  }

  if (!args.candidate) throw new Error(`--candidate is required\n\n${usage()}`);
  if (!Number.isInteger(args.seeds) || args.seeds < 1) {
    throw new Error('--seeds must be a positive integer');
  }
  if (!Number.isInteger(args.seedOffset)) {
    throw new Error('--seed-offset must be an integer');
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const candidate = getCandidate(args.candidate);

  const started = Date.now();
  const result = simulate(candidate, {
    seeds: args.seeds,
    seedOffset: args.seedOffset,
    onProgress: args.quiet
      ? undefined
      : (agentId, done, total) => {
          process.stderr.write(`\r${agentId.padEnd(14)} ${done}/${total}   `);
        },
  });
  if (!args.quiet) process.stderr.write('\r'.padEnd(40) + '\r');

  const isoDate = new Date().toISOString().slice(0, 10);
  const markdown = renderReport(result, isoDate);
  const outPath = args.out
    ? resolve(process.cwd(), args.out)
    : resolve(REPORTS_DIR, `${candidate.id}-${isoDate}.md`);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, markdown, 'utf8');

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  process.stdout.write(`${outPath}\n`);
  process.stderr.write(
    `${candidate.id}: ${result.seeds.length} seeds x 4 agents in ${elapsed}s\n` +
      `  dKnowledge = ${result.primary.dKnowledge.mean.toFixed(4)} ` +
      `(SE ${result.primary.dKnowledge.se.toFixed(4)})\n` +
      `  dSkill     = ${result.primary.dSkill.mean.toFixed(4)} ` +
      `(SE ${result.primary.dSkill.se.toFixed(4)})\n` +
      `  recallShare= ${
        result.primary.recallShare === null
          ? 'UNDEFINED (below noise floor)'
          : result.primary.recallShare.toFixed(4)
      }\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(1);
}
