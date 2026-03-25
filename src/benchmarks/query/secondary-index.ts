import { BaseBenchmark } from '../base.js';
import type { BenchmarkContext } from '../../types.js';

export class SecondaryIndexQuery extends BaseBenchmark {
  name = 'Secondary Index Query (score)';
  group = 'query';
  private idx = 0;

  protected iterationCount(ctx: BenchmarkContext) {
    return ctx.config.readIterations;
  }

  protected async execute(ctx: BenchmarkContext) {
    const lo = (this.idx * 100) % 9000;
    this.idx++;
    await ctx.collection
      .find({ score: { $gte: lo, $lt: lo + 1000 } })
      .limit(100)
      .toArray();
  }
}
