import { BaseBenchmark } from '../base.js';
import { sortIds } from '../../id/compare.js';
import type { BenchmarkContext } from '../../types.js';

export class Aggregation extends BaseBenchmark {
  name = 'Aggregation Pipeline';
  group = 'query';
  private pairs: [any, any][] = [];
  private idx = 0;

  protected iterationCount() {
    return 1000;
  }

  async setup(ctx: BenchmarkContext) {
    const sorted = sortIds(ctx.seededIds);
    this.pairs = [];
    const step = Math.floor(sorted.length / 1000);
    for (let i = 0; i < 1000; i++) {
      const lo = sorted[i * step];
      const hi = sorted[Math.min(i * step + step, sorted.length - 1)];
      this.pairs.push([lo, hi]);
    }
    this.idx = 0;
  }

  protected async execute(ctx: BenchmarkContext) {
    const [lo, hi] = this.pairs[this.idx % this.pairs.length];
    this.idx++;
    await ctx.collection
      .aggregate([
        { $match: { _id: { $gte: lo, $lte: hi } } },
        { $group: { _id: '$status', count: { $sum: 1 }, avgScore: { $avg: '$score' } } },
        { $sort: { count: -1 } },
      ])
      .toArray();
  }
}
