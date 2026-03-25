import { performance } from 'node:perf_hooks';
import { seedCollection } from '../../db/seed.js';
import { createIndexes } from '../../db/schema.js';
import type { BenchmarkContext, BenchmarkResult, BenchmarkSuite, GeneratedId, BenchDoc } from '../../types.js';

export class MixedWorkload implements BenchmarkSuite {
  name = 'Mixed Workload (70/30 read/write)';
  group = 'sustained';

  async setup(ctx: BenchmarkContext) {
    await ctx.db.collection<BenchDoc>('bench_mixed').drop().catch(() => {});
    await createIndexes(ctx.db.collection<BenchDoc>('bench_mixed'));
    console.log('  Seeding for mixed workload...');
    await seedCollection(ctx.db.collection<BenchDoc>('bench_mixed'), ctx.idStrategy, Math.floor(ctx.config.seedCount / 2), false);
  }

  async run(ctx: BenchmarkContext): Promise<BenchmarkResult> {
    const durationMs = ctx.config.mixedDurationSec * 1000;
    const readRatio = ctx.config.mixedReadWriteRatio;
    const col = ctx.db.collection<BenchDoc>('bench_mixed');
    const concurrency = 10;

    // Get some IDs for reads
    const readIds: GeneratedId[] = [];
    const cursor = col.find({}, { projection: { _id: 1 } }).limit(10000);
    for await (const doc of cursor) {
      readIds.push(doc._id as GeneratedId);
    }

    let readOps = 0;
    let writeOps = 0;
    const readLatencies: number[] = [];
    const writeLatencies: number[] = [];

    const totalStart = performance.now();

    async function worker(workerId: number) {
      let localCounter = 0;
      while (performance.now() - totalStart < durationMs) {
        const isRead = Math.random() < readRatio;
        const opStart = performance.now();

        if (isRead && readIds.length > 0) {
          const id = readIds[Math.floor(Math.random() * readIds.length)];
          await col.findOne({ _id: id });
          readLatencies.push(performance.now() - opStart);
          readOps++;
        } else {
          localCounter++;
          const newId = await ctx.idStrategy.generate();
          await col.insertOne({
            _id: newId,
            username: `mixed_w${workerId}_${localCounter}`,
            email: `mixed_w${workerId}_${localCounter}@bench.test`,
            score: localCounter % 10000,
            status: 'active',
            tags: ['mixed'],
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { ip: '10.0.0.1', userAgent: 'bench', region: 'us-east' },
          });
          writeLatencies.push(performance.now() - opStart);
          writeOps++;
          readIds.push(newId);
        }
      }
    }

    const workers = Array.from({ length: concurrency }, (_, i) => worker(i));
    await Promise.all(workers);

    const totalTimeMs = performance.now() - totalStart;
    const totalOps = readOps + writeOps;

    const allLatencies = [...readLatencies, ...writeLatencies].sort((a, b) => a - b);
    const len = allLatencies.length;

    readLatencies.sort((a, b) => a - b);
    writeLatencies.sort((a, b) => a - b);

    return {
      name: this.name,
      mode: ctx.mode,
      totalOps,
      totalTimeMs,
      opsPerSec: (totalOps / totalTimeMs) * 1000,
      latency: {
        min: allLatencies[0] ?? 0,
        max: allLatencies[len - 1] ?? 0,
        avg: len > 0 ? allLatencies.reduce((a, b) => a + b, 0) / len : 0,
        p50: allLatencies[Math.floor(len * 0.5)] ?? 0,
        p95: allLatencies[Math.floor(len * 0.95)] ?? 0,
        p99: allLatencies[Math.floor(len * 0.99)] ?? 0,
      },
      metadata: {
        readOps,
        writeOps,
        readRatio,
        concurrency,
        readP50: readLatencies[Math.floor(readLatencies.length * 0.5)] ?? 0,
        readP99: readLatencies[Math.floor(readLatencies.length * 0.99)] ?? 0,
        writeP50: writeLatencies[Math.floor(writeLatencies.length * 0.5)] ?? 0,
        writeP99: writeLatencies[Math.floor(writeLatencies.length * 0.99)] ?? 0,
      },
    };
  }

  async teardown(ctx: BenchmarkContext) {
    await ctx.db.collection<BenchDoc>('bench_mixed').drop().catch(() => {});
  }
}
