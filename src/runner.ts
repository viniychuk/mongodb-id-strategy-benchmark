import { createClient } from './db/connection.js';
import { createIndexes } from './db/schema.js';
import { seedCollection } from './db/seed.js';
import { createIdStrategy } from './id/strategy.js';
import { getAllBenchmarks } from './benchmarks/registry.js';
import { printResult, printSummary } from './reporting/console.js';
import { writeResults } from './reporting/json.js';
import type { BenchmarkConfig, BenchmarkResult, BenchDoc } from './types.js';

export async function runBenchmarks(config: BenchmarkConfig): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  MongoDB ID Benchmark — mode: ${config.mode}`);
  console.log(`  Seed count: ${config.seedCount.toLocaleString()}`);
  console.log(`${'═'.repeat(60)}`);

  const client = await createClient(config.mongoUri);
  const db = client.db(config.dbName);
  const collection = db.collection<BenchDoc>(config.collectionName);
  const counters = db.collection<{ _id: string; seq: number }>('id_counters');
  const idStrategy = createIdStrategy(config.mode, counters);

  // Clean slate
  await collection.drop().catch(() => {});
  await counters.deleteMany({});
  await createIndexes(collection);

  // Connection warmup — ensure pool is established before timing anything
  await db.command({ ping: 1 });

  // Seed
  console.log('\nSeeding data...');
  const seededIds = await seedCollection(collection, idStrategy, config.seedCount);
  console.log(`  Seeded ${seededIds.length.toLocaleString()} documents.\n`);

  const ctx = { db, collection, mode: config.mode, idStrategy, config, seededIds };

  // Filter benchmarks by group if --only specified
  let benchmarks = getAllBenchmarks();
  if (config.only) {
    benchmarks = benchmarks.filter(b => config.only!.includes(b.group));
  }

  const results: BenchmarkResult[] = [];
  let currentGroup = '';

  for (const bench of benchmarks) {
    if (bench.group !== currentGroup) {
      currentGroup = bench.group;
      console.log(`\n── ${currentGroup.toUpperCase()} ${'─'.repeat(40)}`);
    }

    console.log(`  Running: ${bench.name}...`);

    try {
      if (bench.setup) await bench.setup(ctx);
      const result = await bench.run(ctx);
      results.push(result);
      printResult(result);
      if (bench.teardown) await bench.teardown(ctx);
    } catch (err) {
      console.error(`  ERROR in ${bench.name}:`, err);
    }
  }

  // Summary + output
  printSummary(results);

  const filepath = writeResults(results, config.mode, config.outputDir, config.mongoUri);
  console.log(`\nResults written to: ${filepath}`);

  await client.close();
}
