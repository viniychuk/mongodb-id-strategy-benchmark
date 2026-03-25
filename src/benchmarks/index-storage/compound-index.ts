import { performance } from 'node:perf_hooks';
import { LatencyRecorder } from '../../measurement/timer.js';
import type { BenchmarkContext, BenchmarkResult, BenchmarkSuite } from '../../types.js';

export class CompoundIndexPerf implements BenchmarkSuite {
  name = 'Compound Index (score + _id)';
  group = 'index-storage';

  async setup(ctx: BenchmarkContext) {
    // Create the compound index before measurement
    await ctx.collection.createIndex({ score: 1, _id: 1 });
  }

  async run(ctx: BenchmarkContext): Promise<BenchmarkResult> {
    const iters = ctx.config.readIterations;
    const recorder = new LatencyRecorder(iters);

    // Warmup — let WiredTiger cache stabilize after index creation
    for (let i = 0; i < Math.min(ctx.config.warmupIterations, 50); i++) {
      const lo = (i * 100) % 9000;
      await ctx.collection.find({ score: { $gte: lo, $lt: lo + 500 } }).sort({ score: 1, _id: 1 }).limit(50).toArray();
    }

    const totalStart = performance.now();
    for (let i = 0; i < iters; i++) {
      const lo = (i * 100) % 9000;
      await recorder.measure(() =>
        ctx.collection.find({ score: { $gte: lo, $lt: lo + 500 } }).sort({ score: 1, _id: 1 }).limit(50).toArray()
      );
    }
    const totalTimeMs = performance.now() - totalStart;

    // Get index size after creating compound index
    const stats = await ctx.db.command({ collStats: ctx.config.collectionName });

    return {
      name: this.name,
      mode: ctx.mode,
      totalOps: iters,
      totalTimeMs,
      opsPerSec: (iters / totalTimeMs) * 1000,
      latency: recorder.getStats(),
      metadata: {
        compoundIndexSize: stats.indexSizes?.['score_1__id_1'] ?? 'unknown',
      },
    };
  }
}
