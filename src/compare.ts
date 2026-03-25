import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { BenchmarkResult, IdMode } from './types.js';

interface ResultFile {
  mode: IdMode;
  timestamp: string;
  results: BenchmarkResult[];
}

function loadResults(dir: string): ResultFile[] {
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.error(`No result files found in ${dir}`);
    process.exit(1);
  }

  // Take the latest file for each mode (use mode from JSON, not filename)
  const byMode = new Map<string, ResultFile>();
  for (const f of files) {
    const data: ResultFile = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
    byMode.set(data.mode, data);
  }

  const results: ResultFile[] = [];
  for (const [, data] of byMode) {
    results.push(data);
  }

  return results.sort((a, b) => a.mode.localeCompare(b.mode));
}

function pad(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

function rpad(s: string, len: number): string {
  return s.length >= len ? s : ' '.repeat(len - s.length) + s;
}

function fmt(n: number): string {
  if (n >= 1000) return Math.round(n).toLocaleString();
  return n.toFixed(2);
}

function pctDiff(base: number, compare: number): string {
  if (base === 0) return 'N/A';
  const diff = ((compare - base) / base) * 100;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}%`;
}

const dir = process.argv[2] || './results';
const resultFiles = loadResults(dir);

if (resultFiles.length < 2) {
  console.error('Need at least 2 result files to compare. Run benchmarks for multiple modes first.');
  process.exit(1);
}

const modes = resultFiles.map(r => r.mode);
const benchNames = resultFiles[0].results.map(r => r.name);
const nameWidth = Math.max(...benchNames.map(n => n.length), 10);
const colWidth = 14;

console.log(`\n${'═'.repeat(60)}`);
console.log('  BENCHMARK COMPARISON');
console.log(`${'═'.repeat(60)}\n`);

// Header
const modeHeaders = modes.map(m => rpad(m, colWidth)).join('  ');
console.log(`  ${pad('Benchmark', nameWidth)}  ${modeHeaders}  ${modes.slice(1).map(m => rpad(`vs ${modes[0]}`, colWidth)).join('  ')}`);
console.log(`  ${'─'.repeat(nameWidth + (modes.length * (colWidth + 2)) + (modes.length - 1) * (colWidth + 2))}`);

// Ops/sec comparison
console.log('\n  OPS/SEC:');
for (const benchName of benchNames) {
  const values = resultFiles.map(rf => rf.results.find(r => r.name === benchName)?.opsPerSec ?? 0);
  const cols = values.map(v => rpad(fmt(v), colWidth)).join('  ');
  const diffs = values.slice(1).map(v => rpad(pctDiff(values[0], v), colWidth)).join('  ');
  console.log(`  ${pad(benchName, nameWidth)}  ${cols}  ${diffs}`);
}

// P50 latency comparison
console.log('\n  P50 LATENCY (ms):');
for (const benchName of benchNames) {
  const values = resultFiles.map(rf => rf.results.find(r => r.name === benchName)?.latency.p50 ?? 0);
  const cols = values.map(v => rpad(fmt(v), colWidth)).join('  ');
  const diffs = values.slice(1).map(v => rpad(pctDiff(values[0], v), colWidth)).join('  ');
  console.log(`  ${pad(benchName, nameWidth)}  ${cols}  ${diffs}`);
}

// P99 latency comparison
console.log('\n  P99 LATENCY (ms):');
for (const benchName of benchNames) {
  const values = resultFiles.map(rf => rf.results.find(r => r.name === benchName)?.latency.p99 ?? 0);
  const cols = values.map(v => rpad(fmt(v), colWidth)).join('  ');
  const diffs = values.slice(1).map(v => rpad(pctDiff(values[0], v), colWidth)).join('  ');
  console.log(`  ${pad(benchName, nameWidth)}  ${cols}  ${diffs}`);
}

// Storage metadata (from Index & Storage Size benchmark)
console.log('\n  STORAGE:');
for (const rf of resultFiles) {
  const storageResult = rf.results.find(r => r.name === 'Index & Storage Size');
  if (storageResult?.metadata) {
    const m = storageResult.metadata;
    console.log(`  [${rf.mode}]`);
    console.log(`    avgObjSize:     ${(m.avgObjSize as number).toLocaleString()} bytes`);
    console.log(`    storageSize:    ${(m.storageSize as number).toLocaleString()} bytes`);
    console.log(`    totalIndexSize: ${(m.totalIndexSize as number).toLocaleString()} bytes`);
    if (m.indexSizes && typeof m.indexSizes === 'object') {
      for (const [name, size] of Object.entries(m.indexSizes as Record<string, number>)) {
        console.log(`      ${name}: ${size.toLocaleString()} bytes`);
      }
    }
  }
}

console.log('');
