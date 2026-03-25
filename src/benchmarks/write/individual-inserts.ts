import { faker } from '@faker-js/faker';
import { BaseBenchmark } from '../base.js';
import type { BenchmarkContext, BenchDoc } from '../../types.js';

export class IndividualInserts extends BaseBenchmark {
  name = 'Individual Inserts';
  group = 'write';
  private counter = 0;

  protected iterationCount(ctx: BenchmarkContext) {
    return ctx.config.individualInserts;
  }

  async setup(ctx: BenchmarkContext) {
    this.counter = Date.now();
    await ctx.db.collection<BenchDoc>('bench_write_individual').drop().catch(() => {});
  }

  protected async execute(ctx: BenchmarkContext) {
    this.counter++;
    const col = ctx.db.collection<BenchDoc>('bench_write_individual');
    await col.insertOne({
      _id: await ctx.idStrategy.generate(),
      username: 'user' + this.counter,
      email: `ins${this.counter}@bench.test`,
      score: this.counter % 10000,
      status: ['active', 'inactive', 'pending'][this.counter % 3],
      tags: ['tag1'],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { ip: '10.0.0.1', userAgent: 'bench', region: 'us-east' },
    });
  }

  async teardown(ctx: BenchmarkContext) {
    await ctx.db.collection<BenchDoc>('bench_write_individual').drop().catch(() => {});
  }
}
