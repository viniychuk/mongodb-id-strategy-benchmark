import type { BenchmarkContext, BenchmarkResult, BenchmarkSuite } from '../../types.js';

export class IndexSize implements BenchmarkSuite {
  name = 'Index & Storage Size';
  group = 'index-storage';

  async run(ctx: BenchmarkContext): Promise<BenchmarkResult> {
    const stats = await ctx.db.command({ collStats: ctx.config.collectionName });

    return {
      name: this.name,
      mode: ctx.mode,
      totalOps: 1,
      totalTimeMs: 0,
      opsPerSec: 0,
      latency: { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 },
      metadata: {
        count: stats.count,
        avgObjSize: stats.avgObjSize,
        storageSize: stats.storageSize,
        totalIndexSize: stats.totalIndexSize,
        indexSizes: stats.indexSizes,
      },
    };
  }
}
