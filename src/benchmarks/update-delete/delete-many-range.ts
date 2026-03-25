import { BaseBenchmark } from '../base.js';
import { seedCollection } from '../../db/seed.js';
import { createIndexes } from '../../db/schema.js';
import { sortIds } from '../../id/compare.js';
import type { BenchmarkContext, BenchDoc } from '../../types.js';

export class DeleteManyRange extends BaseBenchmark {
  name = 'Delete Many (range)';
  group = 'update-delete';
  private pairs: [any, any][] = [];
  private idx = 0;

  protected iterationCount() {
    return Math.min(200, this.pairs.length);
  }

  async setup(ctx: BenchmarkContext) {
    const col = ctx.db.collection<BenchDoc>('bench_delete_range');
    await col.drop().catch(() => {});
    await createIndexes(col);
    console.log('  Re-seeding for delete-many-range...');
    const ids = await seedCollection(col, ctx.idStrategy, ctx.config.seedCount, false);
    const sorted = sortIds(ids);
    this.pairs = [];
    const step = Math.floor(sorted.length / 200);
    for (let i = 0; i < 200; i++) {
      const lo = sorted[i * step];
      const hi = sorted[Math.min(i * step + Math.floor(step / 4), sorted.length - 1)];
      this.pairs.push([lo, hi]);
    }
    this.idx = 0;
  }

  protected async execute(ctx: BenchmarkContext) {
    const col = ctx.db.collection<BenchDoc>('bench_delete_range');
    const [lo, hi] = this.pairs[this.idx % this.pairs.length];
    this.idx++;
    await col.deleteMany({ _id: { $gte: lo, $lte: hi } });
  }

  async teardown(ctx: BenchmarkContext) {
    await ctx.db.collection<BenchDoc>('bench_delete_range').drop().catch(() => {});
  }
}
