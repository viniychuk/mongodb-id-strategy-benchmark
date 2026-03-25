import type { BenchmarkResult } from '../types.js';

function pad(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

function rpad(s: string, len: number): string {
  return s.length >= len ? s : ' '.repeat(len - s.length) + s;
}

function fmt(n: number, decimals = 2): string {
  if (n >= 1000) return Math.round(n).toLocaleString();
  return n.toFixed(decimals);
}

export function printResult(r: BenchmarkResult): void {
  console.log(`\n  [${r.mode}] ${r.name}`);
  console.log(`  ${'─'.repeat(50)}`);
  console.log(`  Ops:      ${rpad(r.totalOps.toLocaleString(), 12)}`);
  console.log(`  Time:     ${rpad(fmt(r.totalTimeMs) + 'ms', 12)}`);
  console.log(`  Ops/sec:  ${rpad(fmt(r.opsPerSec, 0), 12)}`);
  console.log(`  Latency:  p50=${fmt(r.latency.p50)}ms  p95=${fmt(r.latency.p95)}ms  p99=${fmt(r.latency.p99)}ms`);
  console.log(`            min=${fmt(r.latency.min)}ms  max=${fmt(r.latency.max)}ms  avg=${fmt(r.latency.avg)}ms`);

  if (r.metadata) {
    for (const [k, v] of Object.entries(r.metadata)) {
      const val = typeof v === 'number' ? v.toLocaleString() : JSON.stringify(v);
      console.log(`  ${k}: ${val}`);
    }
  }
}

export function printSummary(results: BenchmarkResult[]): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  SUMMARY — mode: ${results[0]?.mode ?? 'unknown'}`);
  console.log(`${'═'.repeat(60)}`);

  const nameWidth = Math.max(...results.map(r => r.name.length), 10);

  console.log(
    `  ${pad('Benchmark', nameWidth)}  ${rpad('Ops/sec', 10)}  ${rpad('p50', 8)}  ${rpad('p95', 8)}  ${rpad('p99', 8)}`
  );
  console.log(`  ${'─'.repeat(nameWidth + 42)}`);

  for (const r of results) {
    console.log(
      `  ${pad(r.name, nameWidth)}  ${rpad(fmt(r.opsPerSec, 0), 10)}  ${rpad(fmt(r.latency.p50) + 'ms', 8)}  ${rpad(fmt(r.latency.p95) + 'ms', 8)}  ${rpad(fmt(r.latency.p99) + 'ms', 8)}`
    );
  }
}
