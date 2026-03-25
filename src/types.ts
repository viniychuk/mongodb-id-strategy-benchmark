import type { Collection, Db, ObjectId, Binary, Document } from 'mongodb';

export type IdMode = 'objectid' | 'uuid7' | 'uuid7-string' | 'uuid4' | 'autoincrement' | 'autoincrement-string';

export type GeneratedId = ObjectId | Binary | string | number;

/** Document type with flexible _id to avoid `as any` casts throughout benchmarks. */
export type BenchDoc = Document & { _id: GeneratedId };

export interface IdStrategy {
  mode: IdMode;
  generate(): GeneratedId | Promise<GeneratedId>;
  /** Pre-allocate a batch of IDs. For DB-backed strategies this reduces round trips. */
  generateBatch(count: number): GeneratedId[] | Promise<GeneratedId[]>;
}

export interface BenchmarkConfig {
  mongoUri: string;
  dbName: string;
  collectionName: string;
  seedCount: number;
  warmupIterations: number;
  individualInserts: number;
  bulkBatchSize: number;
  bulkBatches: number;
  upsertCount: number;
  readIterations: number;
  paginationPageSize: number;
  paginationPages: number;
  sustainedDurationSec: number;
  mixedDurationSec: number;
  mixedReadWriteRatio: number;
  mode: IdMode;
  outputDir: string;
  only: string[] | null;
}

export interface LatencyStats {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface BenchmarkResult {
  name: string;
  mode: IdMode;
  totalOps: number;
  totalTimeMs: number;
  opsPerSec: number;
  latency: LatencyStats;
  metadata?: Record<string, unknown>;
}

export interface BenchmarkContext {
  db: Db;
  collection: Collection<BenchDoc>;
  mode: IdMode;
  idStrategy: IdStrategy;
  config: BenchmarkConfig;
  seededIds: GeneratedId[];
}

export interface BenchmarkSuite {
  name: string;
  group: string;
  setup?(ctx: BenchmarkContext): Promise<void>;
  run(ctx: BenchmarkContext): Promise<BenchmarkResult>;
  teardown?(ctx: BenchmarkContext): Promise<void>;
}
