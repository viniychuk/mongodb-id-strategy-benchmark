import { performance } from 'node:perf_hooks';
import { LatencyRecorder } from '../../measurement/timer.js';
import type { BenchmarkContext, BenchmarkResult, BenchmarkSuite, BenchDoc } from '../../types.js';

export class UnorderedBulkInserts implements BenchmarkSuite {
  name = 'Unordered Bulk Inserts';
  group = 'write';

  async setup(ctx: BenchmarkContext) {
    await ctx.db.collection<BenchDoc>('bench_write_unordered').drop().catch(() => {});
  }

  async run(ctx: BenchmarkContext): Promise<BenchmarkResult> {
    const { bulkBatchSize, bulkBatches, warmupIterations } = ctx.config;
    const col = ctx.db.collection<BenchDoc>('bench_write_unordered');
    let counter = 0;

    async function makeBatch() {
      const ids = await ctx.idStrategy.generateBatch(bulkBatchSize);
      const docs = [];
      for (let i = 0; i < bulkBatchSize; i++) {
        counter++;
        docs.push({
          _id: ids[i],
          username: 'user' + counter,
          email: `bulk_u${counter}@bench.test`,
          score: counter % 10000,
          status: ['active', 'inactive', 'pending'][counter % 3],
          tags: ['bulk'],
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { ip: '10.0.0.1', userAgent: 'bench', region: 'us-east' },
        });
      }
      return docs;
    }

    // Warmup
    for (let i = 0; i < Math.min(warmupIterations, 2); i++) {
      await col.insertMany(await makeBatch(), { ordered: false });
    }
    await col.drop().catch(() => {});
    counter = 0;

    const recorder = new LatencyRecorder(bulkBatches);
    let insertTimeMs = 0;

    for (let i = 0; i < bulkBatches; i++) {
      const docs = await makeBatch();
      const t0 = performance.now();
      await recorder.measure(() => col.insertMany(docs, { ordered: false }));
      insertTimeMs += performance.now() - t0;
    }

    const totalTimeMs = insertTimeMs;
    const totalOps = bulkBatches * bulkBatchSize;

    return {
      name: this.name,
      mode: ctx.mode,
      totalOps,
      totalTimeMs,
      opsPerSec: (totalOps / totalTimeMs) * 1000,
      latency: recorder.getStats(),
      metadata: { docsPerBatch: bulkBatchSize, batches: bulkBatches },
    };
  }

  async teardown(ctx: BenchmarkContext) {
    await ctx.db.collection<BenchDoc>('bench_write_unordered').drop().catch(() => {});
  }
}
