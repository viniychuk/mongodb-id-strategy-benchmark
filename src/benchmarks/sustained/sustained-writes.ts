import { performance } from 'node:perf_hooks';
import type { BenchmarkContext, BenchmarkResult, BenchmarkSuite, BenchDoc } from '../../types.js';

export class SustainedWrites implements BenchmarkSuite {
  name = 'Sustained Writes';
  group = 'sustained';

  async setup(ctx: BenchmarkContext) {
    await ctx.db.collection<BenchDoc>('bench_sustained_writes').drop().catch(() => {});
  }

  async run(ctx: BenchmarkContext): Promise<BenchmarkResult> {
    const durationMs = ctx.config.sustainedDurationSec * 1000;
    const col = ctx.db.collection<BenchDoc>('bench_sustained_writes');
    let counter = 0;

    const buckets: number[] = [];
    let currentBucketOps = 0;
    let bucketStart = performance.now();
    const totalStart = performance.now();
    const allLatencies: number[] = [];

    while (performance.now() - totalStart < durationMs) {
      counter++;
      const opStart = performance.now();
      await col.insertOne({
        _id: await ctx.idStrategy.generate(),
        username: 'sustained' + counter,
        email: `sustained${counter}@bench.test`,
        score: counter % 10000,
        status: ['active', 'inactive', 'pending'][counter % 3],
        tags: ['sustained'],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { ip: '10.0.0.1', userAgent: 'bench', region: 'us-east' },
      });
      allLatencies.push(performance.now() - opStart);
      currentBucketOps++;

      if (performance.now() - bucketStart >= 1000) {
        buckets.push(currentBucketOps);
        currentBucketOps = 0;
        bucketStart = performance.now();
      }
    }

    if (currentBucketOps > 0) buckets.push(currentBucketOps);
    const totalTimeMs = performance.now() - totalStart;

    allLatencies.sort((a, b) => a - b);
    const len = allLatencies.length;

    return {
      name: this.name,
      mode: ctx.mode,
      totalOps: counter,
      totalTimeMs,
      opsPerSec: (counter / totalTimeMs) * 1000,
      latency: {
        min: allLatencies[0] ?? 0,
        max: allLatencies[len - 1] ?? 0,
        avg: len > 0 ? allLatencies.reduce((a, b) => a + b, 0) / len : 0,
        p50: allLatencies[Math.floor(len * 0.5)] ?? 0,
        p95: allLatencies[Math.floor(len * 0.95)] ?? 0,
        p99: allLatencies[Math.floor(len * 0.99)] ?? 0,
      },
      metadata: {
        durationSec: ctx.config.sustainedDurationSec,
        throughputPerSecond: buckets,
        avgThroughput: buckets.length > 0 ? Math.round(buckets.reduce((a, b) => a + b, 0) / buckets.length) : 0,
      },
    };
  }

  async teardown(ctx: BenchmarkContext) {
    await ctx.db.collection<BenchDoc>('bench_sustained_writes').drop().catch(() => {});
  }
}
