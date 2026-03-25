import type { BenchmarkSuite } from '../types.js';

// Write
import { IndividualInserts } from './write/individual-inserts.js';
import { UnorderedBulkInserts } from './write/unordered-bulk.js';
import { OrderedBulkInserts } from './write/ordered-bulk.js';
import { Upserts } from './write/upserts.js';

// Read
import { FindById } from './read/find-by-id.js';
import { FindByIdIn } from './read/find-by-id-in.js';
import { RangeScan } from './read/range-scan.js';
import { CursorPagination } from './read/cursor-pagination.js';
import { CursorPaginationCompound } from './read/cursor-pagination-compound.js';
import { CountDocuments } from './read/count-documents.js';
import { RandomAccess } from './read/random-access.js';

// Query
import { SecondaryIndexQuery } from './query/secondary-index.js';
import { SortById } from './query/sort-by-id.js';
import { SortCompound } from './query/sort-compound.js';
import { Aggregation } from './query/aggregation.js';

// Update/Delete
import { UpdateById } from './update-delete/update-by-id.js';
import { UpdateManyRange } from './update-delete/update-many-range.js';
import { DeleteById } from './update-delete/delete-by-id.js';
import { DeleteManyRange } from './update-delete/delete-many-range.js';

// Index/Storage
import { IndexSize } from './index-storage/index-size.js';
import { CompoundIndexPerf } from './index-storage/compound-index.js';

// Sustained
import { SustainedWrites } from './sustained/sustained-writes.js';
import { MixedWorkload } from './sustained/mixed-workload.js';

export function getAllBenchmarks(): BenchmarkSuite[] {
  return [
    // Write
    new IndividualInserts(),
    new UnorderedBulkInserts(),
    new OrderedBulkInserts(),
    new Upserts(),

    // Read
    new FindById(),
    new FindByIdIn(),
    new RangeScan(),
    new CursorPagination(),
    new CursorPaginationCompound(),
    new CountDocuments(),
    new RandomAccess(),

    // Query
    new SecondaryIndexQuery(),
    new SortById(),
    new SortCompound(),
    new Aggregation(),

    // Update/Delete
    new UpdateById(),
    new UpdateManyRange(),
    new DeleteById(),
    new DeleteManyRange(),

    // Index/Storage
    new IndexSize(),
    new CompoundIndexPerf(),

    // Sustained
    new SustainedWrites(),
    new MixedWorkload(),
  ];
}
