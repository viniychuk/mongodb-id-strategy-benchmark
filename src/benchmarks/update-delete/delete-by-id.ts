import { BaseBenchmark } from '../base.js';
import { seedCollection } from '../../db/seed.js';
import { createIndexes } from '../../db/schema.js';
import type { BenchmarkContext, GeneratedId, BenchDoc } from '../../types.js';

export class DeleteById extends BaseBenchmark {
  name = 'Delete by _id';
  group = 'update-delete';
  private deleteIds: GeneratedId[] = [];
  private idx = 0;

  protected iterationCount(ctx: BenchmarkContext) {
    return Math.min(ctx.config.readIterations, this.deleteIds.length);
  }

  async setup(ctx: BenchmarkContext) {
    // Re-seed into a dedicated collection for destructive test
    const col = ctx.db.collection<BenchDoc>('bench_delete_single');
    await col.drop().catch(() => {});
    await createIndexes(col);
    console.log('  Re-seeding for delete-by-id...');
    this.deleteIds = await seedCollection(col, ctx.idStrategy, ctx.config.seedCount, false);
    this.idx = 0;
  }

  protected async execute(ctx: BenchmarkContext) {
    const col = ctx.db.collection<BenchDoc>('bench_delete_single');
    const id = this.deleteIds[this.idx];
    this.idx++;
    await col.deleteOne({ _id: id });
  }

  async teardown(ctx: BenchmarkContext) {
    await ctx.db.collection<BenchDoc>('bench_delete_single').drop().catch(() => {});
  }
}
