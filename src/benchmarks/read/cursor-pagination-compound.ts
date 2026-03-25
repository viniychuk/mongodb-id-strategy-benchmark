import { performance } from 'node:perf_hooks';
import { LatencyRecorder } from '../../measurement/timer.js';
import type { BenchmarkContext, BenchmarkResult, BenchmarkSuite } from '../../types.js';

export class CursorPaginationCompound implements BenchmarkSuite {
  name = 'Cursor Pagination (createdAt + _id)';
  group = 'read';

  async run(ctx: BenchmarkContext): Promise<BenchmarkResult> {
    const { paginationPageSize, paginationPages, warmupIterations } = ctx.config;

    const first = await ctx.collection.findOne(
      {},
      { sort: { createdAt: 1, _id: 1 }, projection: { _id: 1, createdAt: 1 } },
    );
    if (!first) throw new Error('Collection is empty');

    // Warmup
    let lastCreatedAt = first.createdAt;
    let lastId = first._id;
    for (let i = 0; i < Math.min(warmupIterations, 10); i++) {
      const docs = await ctx.collection
        .find({
          $or: [
            { createdAt: { $gt: lastCreatedAt } },
            { createdAt: lastCreatedAt, _id: { $gt: lastId } },
          ],
        })
        .sort({ createdAt: 1, _id: 1 })
        .limit(paginationPageSize)
        .toArray();
      if (docs.length > 0) {
        lastCreatedAt = docs[docs.length - 1].createdAt;
        lastId = docs[docs.length - 1]._id;
      }
    }

    // Measurement
    lastCreatedAt = first.createdAt;
    lastId = first._id;
    const pageRecorder = new LatencyRecorder(paginationPages);
    const totalStart = performance.now();
    let totalDocs = 0;
    let pagesRead = 0;

    for (let page = 0; page < paginationPages; page++) {
      const docs = await pageRecorder.measure(async () => {
        return ctx.collection
          .find({
            $or: [
              { createdAt: { $gt: lastCreatedAt } },
              { createdAt: lastCreatedAt, _id: { $gt: lastId } },
            ],
          })
          .sort({ createdAt: 1, _id: 1 })
          .limit(paginationPageSize)
          .toArray();
      });

      pagesRead++;
      totalDocs += docs.length;
      if (docs.length === 0) break;
      lastCreatedAt = docs[docs.length - 1].createdAt;
      lastId = docs[docs.length - 1]._id;
    }

    const totalTimeMs = performance.now() - totalStart;

    return {
      name: this.name,
      mode: ctx.mode,
      totalOps: pagesRead,
      totalTimeMs,
      opsPerSec: (pagesRead / totalTimeMs) * 1000,
      latency: pageRecorder.getStats(),
      metadata: { pageSize: paginationPageSize, pagesRead, totalDocsTraversed: totalDocs },
    };
  }
}
