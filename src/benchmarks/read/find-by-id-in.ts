import { BaseBenchmark } from '../base.js';
import type { BenchmarkContext } from '../../types.js';

export class FindByIdIn extends BaseBenchmark {
  name = 'Find by _id $in';
  group = 'read';
  private batches: any[][] = [];
  private idx = 0;

  protected iterationCount(ctx: BenchmarkContext) {
    return Math.min(ctx.config.readIterations, this.batches.length);
  }

  async setup(ctx: BenchmarkContext) {
    const batchSize = 50;
    this.batches = [];
    const ids = ctx.seededIds;
    // Create batches of 50 random ids
    for (let i = 0; i < ctx.config.readIterations && i * batchSize < ids.length; i++) {
      const start = (i * 37) % Math.max(1, ids.length - batchSize);
      this.batches.push(ids.slice(start, start + batchSize));
    }
    this.idx = 0;
  }

  protected async execute(ctx: BenchmarkContext) {
    const batch = this.batches[this.idx % this.batches.length];
    this.idx++;
    await ctx.collection.find({ _id: { $in: batch } }).toArray();
  }
}
