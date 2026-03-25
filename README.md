# MongoDB _id Strategy Benchmark

Benchmarks 6 different `_id` strategies in MongoDB across 22 operations to help you choose the right ID type for your workload.

**[View full interactive results with charts](https://viniychuk.github.io/mongodb-id-strategy-benchmark/)**

## Key Findings

> Tested on Apple M5 Max, 128 GB RAM, MongoDB 8.2.6, Node v24.14.0. 100K seeded documents, 5 runs with randomized mode order. Numbers below from median run.

### Individual Inserts (ops/sec) — includes ID generation cost

```mermaid
xychart-beta horizontal
  x-axis ["ObjectId", "UUID v7 (Bin)", "UUID v7 (Str)", "UUID v4", "AutoInc", "AutoInc-Str"]
  y-axis "ops/sec" 0 --> 20000
  bar [18033, 18824, 18282, 17916, 9437, 9191]
```

**Auto-increment is ~50% slower** for individual inserts because each insert requires a `findOneAndUpdate` round-trip to a counter collection before the actual insert. All other strategies generate IDs client-side for ~0ms.

### Bulk Inserts — Unordered (ops/sec)

```mermaid
xychart-beta horizontal
  x-axis ["ObjectId", "UUID v7 (Bin)", "UUID v7 (Str)", "UUID v4", "AutoInc", "AutoInc-Str"]
  y-axis "ops/sec" 0 --> 450000
  bar [390739, 372520, 340565, 338648, 420211, 397546]
```

With batch ID pre-allocation, **auto-increment leads bulk writes** (+8% vs ObjectId) thanks to sequential keys that append to B-tree leaf pages. **UUID v4 trails** (-13%) due to random key scatter.

### Mixed Workload — 70/30 Read/Write, 10 Workers (ops/sec)

```mermaid
xychart-beta horizontal
  x-axis ["ObjectId", "UUID v7 (Bin)", "UUID v7 (Str)", "UUID v4", "AutoInc", "AutoInc-Str"]
  y-axis "ops/sec" 0 --> 50000
  bar [43112, 46792, 44815, 42379, 35090, 36983]
```

Under concurrent load, **auto-increment drops 19%** vs ObjectId — the counter document becomes a serialization bottleneck. All client-side strategies perform within 10% of each other.

### Total Index Size (bytes, 100K documents)

```mermaid
xychart-beta horizontal
  x-axis ["ObjectId", "UUID v7 (Bin)", "UUID v7 (Str)", "UUID v4", "AutoInc", "AutoInc-Str"]
  y-axis "bytes" 0 --> 16000000
  bar [1290240, 1380352, 14807040, 12705792, 1359872, 9994240]
```

Local WiredTiger reports artificially small sizes for compact modes (4 KB page minimums). On **Atlas M50, the real overhead is ~14%** (ObjectId: 32 MB vs UUID v7 string: 37 MB total index for 100K docs). The `_id_` index itself grows from 3.7 MB to 5.5 MB (+49%), and compound indexes containing `_id` pay the same per-entry overhead. UUID v7 binary stays comparable to ObjectId.

### Bottom Line

| If your use case is... | Best choice | Why |
|---|---|---|
| General purpose, MongoDB-only | **ObjectId** | Smallest indexes, zero config, built-in timestamp, no pathological cases |
| IDs cross service/database boundaries | **UUID v7 (String)** | Universally portable, time-sortable, ~5-10% throughput cost, ~14% total index overhead on Atlas |
| Need compact UUID storage | **UUID v7 (Binary)** | Same performance as ObjectId, but requires serialize/deserialize at API boundaries |
| Sequential write-heavy, single writer | **Auto-increment (Number)** | Best bulk insert throughput, but counter is a bottleneck under concurrency |
| Any use case | **Avoid UUID v4** | Random keys destroy range scan performance (-62%) with no compensating benefit |

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

- **Variance:** Published results are from the median of 5 runs. Use `--runs N` to generate your own multi-run data.
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
