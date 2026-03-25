import { performance } from 'node:perf_hooks';
import { LatencyRecorder } from '../../measurement/timer.js';
import type { BenchmarkContext, BenchmarkResult, BenchmarkSuite } from '../../types.js';

export class CursorPagination implements BenchmarkSuite {
  name = 'Cursor Pagination (_id)';
  group = 'read';

  async run(ctx: BenchmarkContext): Promise<BenchmarkResult> {
    const { paginationPageSize, paginationPages, warmupIterations } = ctx.config;

    // Find the minimum _id to start from
    const first = await ctx.collection.findOne({}, { sort: { _id: 1 }, projection: { _id: 1 } });
    if (!first) throw new Error('Collection is empty');

    // Warmup: paginate a few pages
    let cursor = first._id;
    for (let i = 0; i < Math.min(warmupIterations, 10); i++) {
      const docs = await ctx.collection
        .find({ _id: { $gt: cursor } })
        .sort({ _id: 1 })
        .limit(paginationPageSize)
        .toArray();
      if (docs.length > 0) cursor = docs[docs.length - 1]._id;
    }

    // Measurement: paginate from the beginning
    const pageRecorder = new LatencyRecorder(paginationPages);
    cursor = first._id;
    const totalStart = performance.now();
    let totalDocs = 0;
    let pagesRead = 0;

    for (let page = 0; page < paginationPages; page++) {
      const docs = await pageRecorder.measure(async () => {
        return ctx.collection
          .find({ _id: { $gt: cursor } })
          .sort({ _id: 1 })
          .limit(paginationPageSize)
          .toArray();
      });

      pagesRead++;
      totalDocs += docs.length;
      if (docs.length === 0) break;
      cursor = docs[docs.length - 1]._id;
    }

    const totalTimeMs = performance.now() - totalStart;

    return {
      name: this.name,
      mode: ctx.mode,
      totalOps: pagesRead,
      totalTimeMs,
      opsPerSec: (pagesRead / totalTimeMs) * 1000,
      latency: pageRecorder.getStats(),
      metadata: {
        pageSize: paginationPageSize,
        pagesRead,
        totalDocsTraversed: totalDocs,
      },
    };
  }
}
