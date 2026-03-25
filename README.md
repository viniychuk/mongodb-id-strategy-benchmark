# MongoDB _id Strategy Benchmark

Benchmarks 6 different `_id` strategies in MongoDB across 22 operations to help you choose the right ID type for your workload.

**[View interactive results](https://viniychuk.github.io/mongodb-id-strategy-benchmark/)**

## Strategies Tested

| Strategy | `_id` type | Generation | Time-sortable |
|---|---|---|---|
| **ObjectId** | ObjectId (12 bytes) | Client-side, built-in | Yes (seconds) |
| **UUID v7 (Binary)** | BinData subtype 4 (16 bytes) | Client-side | Yes (milliseconds) |
| **UUID v7 (String)** | String (36 chars) | Client-side | Yes (milliseconds) |
| **UUID v4** | UUID (16 bytes) | Client-side | No (random) |
| **Auto-increment (Number)** | Number | DB counter via `findOneAndUpdate` | By insertion order |
| **Auto-increment (String)** | String | DB counter via `findOneAndUpdate` | No (lexicographic) |

## Benchmarks

- **Write:** Individual inserts, ordered/unordered bulk inserts, upserts
- **Read:** Find by `_id`, `$in` lookups, range scans, cursor pagination, random access
- **Query:** Secondary index queries, sort by `_id`, compound sorts, aggregation pipelines
- **Update/Delete:** Single-document and range updates/deletes
- **Storage:** Index and document sizes per strategy
- **Sustained:** 30-second continuous writes + mixed 70/30 read/write with 10 concurrent workers

## Quick Start

```bash
npm install

# Run all benchmarks (local MongoDB)
npm run bench:all

# Run all benchmarks (Atlas)
npm run bench:all -- --uri "mongodb+srv://user:pass@cluster.mongodb.net"

# Quick run for remote/slow connections (~10x faster, fewer iterations)
npm run bench:all -- --scale 0.1 --uri "mongodb+srv://..."

# Run a single mode
npx tsx src/index.ts --mode objectid

# Compare results
npm run compare          # Terminal output
npm run compare:html     # HTML report with charts
```

## Options

| Flag | Default | Description |
|---|---|---|
| `--mode` | (required) | `objectid`, `uuid7`, `uuid7-string`, `uuid4`, `autoincrement`, `autoincrement-string` |
| `--uri` | `mongodb://localhost:27017` | MongoDB connection string |
| `--scale` | `1` | Scale factor for iteration counts. Use `0.1` for Atlas, `0.5` for medium runs |
| `--seed-count` | `100000` (scaled) | Number of documents to seed |
| `--output` | `./results` | Output directory for result JSON files |
| `--only` | all | Comma-separated benchmark groups: `write,read,query,update-delete,index-storage,sustained` |

## Methodology

### What's measured

- **Individual writes** include ID generation time. This is intentional — auto-increment modes pay a real `findOneAndUpdate` round-trip per ID, while UUID/ObjectId generate IDs client-side for ~0ms. This reflects real-world cost.
- **Bulk writes** use batch ID allocation (one `findOneAndUpdate` per batch for auto-increment). The `insertMany` latency is measured separately from batch preparation.
- **Read/query benchmarks** use IDs from the seeded collection, sorted in MongoDB's native comparison order per type.
- **Sustained/mixed workloads** run for a fixed duration with real-time throughput tracking.

### Fairness measures

- **Randomized mode order:** `bench:all` shuffles the 6 modes via Fisher-Yates to eliminate first-mover cache bias.
- **Warmup iterations:** Each benchmark runs warmup iterations before measurement.
- **Isolated collections:** Write benchmarks use separate collections to avoid cross-benchmark interference.
- **Proper Binary sort:** Range-based benchmarks sort IDs using MongoDB's native byte-order comparison (not JavaScript's `.toString()` sort).

### Known limitations

- **Single run:** Results are from a single execution. For statistical rigor, run multiple times and compare.
- **Write concern:** Default `w:1`. Production workloads often use `w:majority` which adds latency.
- **Auto-increment string sort:** String representations of numbers sort lexicographically (`"9" > "10000"`). Range scans on auto-increment string `_id` return results in non-numeric order. This is a real limitation of this ID strategy, not a benchmark bug.
- **100K seed size:** Index sizes at 100K documents may not reflect production scale due to WiredTiger page allocation minimums.

## Contention Test

Test auto-increment counter atomicity and throughput under concurrent load:

```bash
npx tsx src/test-contention.ts --concurrency 10 --ids 1000
npx tsx src/test-contention.ts --concurrency 50 --ids 2000 --uri "mongodb+srv://..."
```

## Project Structure

```
src/
  index.ts              # Entry point
  config.ts             # CLI argument parsing
  runner.ts             # Benchmark orchestrator
  bench-all.ts          # Run all modes with shuffling + timing
  compare.ts            # Terminal comparison output
  compare-html.ts       # HTML comparison report
  test-contention.ts    # Auto-increment contention test
  types.ts              # TypeScript interfaces
  id/
    strategy.ts         # ID generation strategies
    compare.ts          # ID comparison (MongoDB-native sort order)
  db/
    connection.ts       # MongoDB client setup
    schema.ts           # Index definitions
    seed.ts             # Data seeding
  benchmarks/           # Individual benchmark implementations
  measurement/          # Latency recording
  reporting/            # Console + JSON output
```

## License

MIT
