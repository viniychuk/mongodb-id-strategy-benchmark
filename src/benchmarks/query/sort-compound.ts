import { BaseBenchmark } from '../base.js';
import type { BenchmarkContext } from '../../types.js';

const STATUSES = ['active', 'inactive', 'pending'];

export class SortCompound extends BaseBenchmark {
  name = 'Compound Sort (createdAt + _id)';
  group = 'query';
  private idx = 0;

  protected iterationCount(ctx: BenchmarkContext) {
    return ctx.config.readIterations;
  }

  protected async execute(ctx: BenchmarkContext) {
    const status = STATUSES[this.idx % STATUSES.length];
    this.idx++;
    await ctx.collection
      .find({ status })
      .sort({ createdAt: 1, _id: 1 })
      .limit(100)
      .toArray();
  }
}
