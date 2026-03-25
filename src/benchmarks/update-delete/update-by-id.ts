import { BaseBenchmark } from '../base.js';
import type { BenchmarkContext } from '../../types.js';

export class UpdateById extends BaseBenchmark {
  name = 'Update by _id';
  group = 'update-delete';
  private idx = 0;

  protected iterationCount(ctx: BenchmarkContext) {
    return ctx.config.readIterations;
  }

  protected async execute(ctx: BenchmarkContext) {
    const id = ctx.seededIds[this.idx % ctx.seededIds.length];
    this.idx++;
    await ctx.collection.updateOne(
      { _id: id },
      { $set: { updatedAt: new Date(), score: this.idx % 10000 } },
    );
  }
}
