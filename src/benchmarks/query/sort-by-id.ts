import { performance } from 'node:perf_hooks';
import { LatencyRecorder } from '../../measurement/timer.js';
import type { BenchmarkContext, BenchmarkResult, BenchmarkSuite } from '../../types.js';

export class SortById implements BenchmarkSuite {
  name = 'Sort by _id';
  group = 'query';

  async run(ctx: BenchmarkContext): Promise<BenchmarkResult> {
    const iters = ctx.config.readIterations;
    const recorder = new LatencyRecorder(iters);

    // Warmup
    for (let i = 0; i < Math.min(ctx.config.warmupIterations, 50); i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      await ctx.collection.find().sort({ _id: dir as 1 | -1 }).limit(100).toArray();
    }

    const totalStart = performance.now();
    for (let i = 0; i < iters; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      await recorder.measure(() =>
        ctx.collection.find().sort({ _id: dir as 1 | -1 }).limit(100).toArray()
      );
    }
    const totalTimeMs = performance.now() - totalStart;

    return {
      name: this.name,
      mode: ctx.mode,
      totalOps: iters,
      totalTimeMs,
      opsPerSec: (iters / totalTimeMs) * 1000,
      latency: recorder.getStats(),
      metadata: { alternatesAscDesc: true },
    };
  }
}
