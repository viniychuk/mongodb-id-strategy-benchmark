import { BaseBenchmark } from '../base.js';
import type { BenchmarkContext, GeneratedId } from '../../types.js';

export class RandomAccess extends BaseBenchmark {
  name = 'Random Access by _id';
  group = 'read';
  private shuffled: GeneratedId[] = [];
  private idx = 0;

  protected iterationCount(ctx: BenchmarkContext) {
    return ctx.config.readIterations;
  }

  async setup(ctx: BenchmarkContext) {
    // Fisher-Yates shuffle of seeded IDs for random access pattern
    this.shuffled = [...ctx.seededIds];
    for (let i = this.shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffled[i], this.shuffled[j]] = [this.shuffled[j], this.shuffled[i]];
    }
    this.idx = 0;
  }

  protected async execute(ctx: BenchmarkContext) {
    const id = this.shuffled[this.idx % this.shuffled.length];
    this.idx++;
    await ctx.collection.findOne({ _id: id });
  }
}
