import type { BenchmarkConfig, IdMode } from './types.js';

const VALID_MODES: IdMode[] = ['objectid', 'uuid7', 'uuid7-string', 'uuid4', 'autoincrement', 'autoincrement-string'];
const VALID_GROUPS = ['write', 'read', 'query', 'update-delete', 'index-storage', 'sustained'];

export function parseConfig(argv: string[]): BenchmarkConfig {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && i + 1 < argv.length) {
      args.set(argv[i].slice(2), argv[i + 1]);
      i++;
    }
  }

  const mode = args.get('mode') as IdMode;
  if (!mode || !VALID_MODES.includes(mode)) {
    console.error(`Usage: --mode ${VALID_MODES.join('|')}`);
    process.exit(1);
  }

  const only = args.get('only')?.split(',').filter(g => VALID_GROUPS.includes(g)) ?? null;

  // --scale 0.1 = quick (Atlas-friendly), 0.5 = medium, 1.0 = full (default)
  const scale = parseFloat(args.get('scale') ?? '1');
  const s = (n: number) => Math.max(1, Math.round(n * scale));

  return {
    mode,
    mongoUri: args.get('uri') ?? 'mongodb://localhost:27017',
    dbName: args.get('db') ?? 'bench_' + mode,
    collectionName: 'documents',
    seedCount: parseInt(args.get('seed-count') ?? String(s(100_000)), 10),
    warmupIterations: s(100),
    individualInserts: s(10_000),
    bulkBatchSize: 5_000,
    bulkBatches: s(20),
    upsertCount: s(10_000),
    readIterations: s(10_000),
    paginationPageSize: 50,
    paginationPages: s(200),
    sustainedDurationSec: Math.max(5, Math.round(30 * scale)),
    mixedDurationSec: Math.max(5, Math.round(30 * scale)),
    mixedReadWriteRatio: 0.7,
    outputDir: args.get('output') ?? './results',
    only: only?.length ? only : null,
  };
}
