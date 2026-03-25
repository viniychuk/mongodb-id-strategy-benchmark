import { createClient } from './db/connection.js';
import { createIdStrategy } from './id/strategy.js';
import type { GeneratedId } from './types.js';

const uri = process.argv.find((_, i, a) => a[i - 1] === '--uri') ?? 'mongodb://localhost:27017';
const concurrency = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--concurrency') ?? '10', 10);
const idsPerWorker = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--ids') ?? '1000', 10);

async function main() {
  const client = await createClient(uri);
  const db = client.db('bench_contention_test');
  const counters = db.collection<{ _id: string; seq: number }>('id_counters');
  await counters.deleteMany({});

  const strategy = createIdStrategy('autoincrement', counters);

  console.log(`Testing autoincrement contention`);
  console.log(`  Concurrency: ${concurrency} workers`);
  console.log(`  IDs per worker: ${idsPerWorker}`);
  console.log(`  Total IDs: ${concurrency * idsPerWorker}\n`);

  // Test 1: Concurrent single-ID generation (worst case)
  console.log('── Single-ID generation (findOneAndUpdate per ID) ──');
  await counters.deleteMany({});
  const allIds: GeneratedId[] = [];
  const start = performance.now();

  const workers = Array.from({ length: concurrency }, async (_, workerIdx) => {
    const ids: GeneratedId[] = [];
    for (let i = 0; i < idsPerWorker; i++) {
      ids.push(await strategy.generate());
    }
    return ids;
  });

  const results = await Promise.all(workers);
  const singleDuration = performance.now() - start;

  for (const ids of results) allIds.push(...ids);

  const uniqueIds = new Set(allIds.map(String));
  const totalIds = allIds.length;
  const duplicates = totalIds - uniqueIds.size;

  console.log(`  Total IDs generated: ${totalIds}`);
  console.log(`  Unique IDs: ${uniqueIds.size}`);
  console.log(`  Duplicates: ${duplicates}`);
  console.log(`  Time: ${(singleDuration / 1000).toFixed(2)}s`);
  console.log(`  Throughput: ${Math.round(totalIds / (singleDuration / 1000))} IDs/sec`);
  console.log(`  ${duplicates === 0 ? '✓ PASS — no collisions' : '✗ FAIL — collisions detected!'}\n`);

  // Test 2: Concurrent batch generation
  console.log('── Batch generation (findOneAndUpdate per batch) ──');
  await counters.deleteMany({});
  const allBatchIds: GeneratedId[] = [];
  const batchStart = performance.now();

  const batchWorkers = Array.from({ length: concurrency }, async () => {
    return strategy.generateBatch(idsPerWorker);
  });

  const batchResults = await Promise.all(batchWorkers);
  const batchDuration = performance.now() - batchStart;

  for (const ids of batchResults) allBatchIds.push(...ids);

  const uniqueBatchIds = new Set(allBatchIds.map(String));
  const totalBatchIds = allBatchIds.length;
  const batchDuplicates = totalBatchIds - uniqueBatchIds.size;

  console.log(`  Total IDs generated: ${totalBatchIds}`);
  console.log(`  Unique IDs: ${uniqueBatchIds.size}`);
  console.log(`  Duplicates: ${batchDuplicates}`);
  console.log(`  Time: ${(batchDuration / 1000).toFixed(2)}s`);
  console.log(`  Throughput: ${Math.round(totalBatchIds / (batchDuration / 1000))} IDs/sec`);
  console.log(`  ${batchDuplicates === 0 ? '✓ PASS — no collisions' : '✗ FAIL — collisions detected!'}\n`);

  // Summary
  console.log('── Comparison ──');
  console.log(`  Single-ID throughput: ${Math.round(totalIds / (singleDuration / 1000))} IDs/sec`);
  console.log(`  Batch throughput:     ${Math.round(totalBatchIds / (batchDuration / 1000))} IDs/sec`);
  console.log(`  Batch speedup:        ${(singleDuration / batchDuration).toFixed(1)}x`);

  await client.close();
}

main();
