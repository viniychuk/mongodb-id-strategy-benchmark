import { BaseBenchmark } from '../base.js';
import type { BenchmarkContext, GeneratedId, BenchDoc } from '../../types.js';

export class Upserts extends BaseBenchmark {
  name = 'Upserts';
  group = 'write';
  private ids: GeneratedId[] = [];
  private counter = 0;

  protected iterationCount(ctx: BenchmarkContext) {
    return ctx.config.upsertCount;
  }

  async setup(ctx: BenchmarkContext) {
    await ctx.db.collection<BenchDoc>('bench_write_upserts').drop().catch(() => {});
    // Pre-generate IDs: half will be new, half will be updates
    this.ids = await ctx.idStrategy.generateBatch(ctx.config.upsertCount);
    this.counter = 0;
  }

  protected async execute(ctx: BenchmarkContext) {
    const col = ctx.db.collection<BenchDoc>('bench_write_upserts');
    // First half: new inserts via upsert. Second half: updates to already-inserted docs
    const idx = this.counter < this.ids.length / 2
      ? this.counter
      : this.counter - Math.floor(this.ids.length / 2);
    const id = this.ids[idx];
    this.counter++;

    await col.updateOne(
      { _id: id },
      {
        $set: {
          username: 'upsert_user' + this.counter,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          email: `upsert${this.counter}@bench.test`,
          score: this.counter % 10000,
          status: 'active',
          tags: ['upsert'],
          createdAt: new Date(),
          metadata: { ip: '10.0.0.1', userAgent: 'bench', region: 'us-east' },
        },
      },
      { upsert: true },
    );
  }

  async teardown(ctx: BenchmarkContext) {
    await ctx.db.collection<BenchDoc>('bench_write_upserts').drop().catch(() => {});
  }
}
