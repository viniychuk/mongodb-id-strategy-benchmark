import { BaseBenchmark } from '../base.js';
import type { BenchmarkContext } from '../../types.js';

const STATUSES = ['active', 'inactive', 'pending'];

export class CountDocuments extends BaseBenchmark {
  name = 'Count Documents';
  group = 'read';
  private idx = 0;

  protected iterationCount() {
    return 1000;
  }

  protected async execute(ctx: BenchmarkContext) {
    const status = STATUSES[this.idx % STATUSES.length];
    this.idx++;
    await ctx.collection.countDocuments({ status });
  }
}
