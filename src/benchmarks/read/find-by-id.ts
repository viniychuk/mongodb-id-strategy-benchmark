import { BaseBenchmark } from '../base.js';
import type { BenchmarkContext } from '../../types.js';

export class FindById extends BaseBenchmark {
  name = 'Find by _id';
  group = 'read';
  private idx = 0;

  protected iterationCount(ctx: BenchmarkContext) {
    return ctx.config.readIterations;
  }

  protected async execute(ctx: BenchmarkContext) {
    const id = ctx.seededIds[this.idx % ctx.seededIds.length];
    this.idx++;
    await ctx.collection.findOne({ _id: id });
  }
}
