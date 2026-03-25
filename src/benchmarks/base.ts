import { performance } from 'node:perf_hooks';
import { LatencyRecorder } from '../measurement/timer.js';
import type { BenchmarkContext, BenchmarkResult, BenchmarkSuite } from '../types.js';

export abstract class BaseBenchmark implements BenchmarkSuite {
  abstract name: string;
  abstract group: string;

  protected abstract execute(ctx: BenchmarkContext): Promise<void>;
  protected abstract iterationCount(ctx: BenchmarkContext): number;

  async run(ctx: BenchmarkContext): Promise<BenchmarkResult> {
    const iters = this.iterationCount(ctx);

    // Warmup
    const warmup = Math.min(ctx.config.warmupIterations, iters);
    for (let i = 0; i < warmup; i++) {
      await this.execute(ctx);
    }

    const recorder = new LatencyRecorder(iters);
    const totalStart = performance.now();

    for (let i = 0; i < iters; i++) {
      await recorder.measure(() => this.execute(ctx));
    }

    const totalTimeMs = performance.now() - totalStart;

    return {
      name: this.name,
      mode: ctx.mode,
      totalOps: iters,
      totalTimeMs,
      opsPerSec: (iters / totalTimeMs) * 1000,
      latency: recorder.getStats(),
    };
  }
}
