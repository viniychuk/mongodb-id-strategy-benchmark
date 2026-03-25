import { BaseBenchmark } from '../base.js';
import { sortIds } from '../../id/compare.js';
import type { BenchmarkContext } from '../../types.js';

export class UpdateManyRange extends BaseBenchmark {
  name = 'Update Many (range)';
  group = 'update-delete';
  private pairs: [any, any][] = [];
  private idx = 0;

  protected iterationCount() {
    return 500;
  }

  async setup(ctx: BenchmarkContext) {
    const sorted = sortIds(ctx.seededIds);
    this.pairs = [];
    const step = Math.floor(sorted.length / 500);
    for (let i = 0; i < 500; i++) {
      const lo = sorted[i * step];
      const hi = sorted[Math.min(i * step + Math.floor(step / 2), sorted.length - 1)];
      this.pairs.push([lo, hi]);
    }
    this.idx = 0;
  }

  protected async execute(ctx: BenchmarkContext) {
    const [lo, hi] = this.pairs[this.idx % this.pairs.length];
    this.idx++;
    await ctx.collection.updateMany(
      { _id: { $gte: lo, $lte: hi } },
      { $set: { updatedAt: new Date() } },
    );
  }
}
