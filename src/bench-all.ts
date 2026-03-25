import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Parse --runs from args (default 1)
const args = process.argv.slice(2);
const runsIdx = args.indexOf('--runs');
const totalRuns = runsIdx >= 0 ? parseInt(args[runsIdx + 1], 10) : 1;
// Remove --runs from forwarded args
const extraArgs = args.filter((_, i) => i !== runsIdx && i !== runsIdx + 1);

const modes = ['objectid', 'uuid7', 'uuid7-string', 'uuid4', 'autoincrement', 'autoincrement-string'];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = Math.round(secs % 60);
  return `${mins}m ${remainSecs}s`;
}

function shuffle(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const totalStart = performance.now();

for (let run = 1; run <= totalRuns; run++) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const runLabel = totalRuns > 1 ? `_run${run}` : '';
  const outDir = join('results', ts + runLabel);
  mkdirSync(outDir, { recursive: true });

  const order = shuffle(modes);

  if (totalRuns > 1) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  RUN ${run} of ${totalRuns}`);
    console.log(`${'='.repeat(60)}`);
  }
  console.log(`Run order: ${order.join(', ')}\n`);

  const timings: { mode: string; duration: number }[] = [];
  const runStart = performance.now();

  for (const mode of order) {
    const modeStart = performance.now();
    console.log(`▶ Running benchmark: ${mode}...\n`);
    execFileSync('npx', ['tsx', 'src/index.ts', '--mode', mode, '--output', outDir, ...extraArgs], { stdio: 'inherit' });
    const duration = performance.now() - modeStart;
    timings.push({ mode, duration });
    console.log(`\n✓ ${mode} completed in ${formatDuration(duration)}\n`);
  }

  // Save run metadata
  writeFileSync(join(outDir, '_meta.json'), JSON.stringify({
    run,
    totalRuns,
    executionOrder: order,
    timings: Object.fromEntries(timings.map(t => [t.mode, Math.round(t.duration)])),
    totalDurationMs: Math.round(performance.now() - runStart),
    timestamp: new Date().toISOString(),
  }, null, 2));

  console.log(`▶ Generating comparison reports\n`);
  execFileSync('npx', ['tsx', 'src/compare-html.ts', outDir], { stdio: 'inherit' });
  execFileSync('npx', ['tsx', 'src/compare.ts', outDir], { stdio: 'inherit' });

  const runDuration = performance.now() - runStart;

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  TIMING SUMMARY${totalRuns > 1 ? ` (run ${run})` : ''}`);
  console.log(`${'═'.repeat(50)}`);
  for (const { mode, duration } of timings) {
    console.log(`  ${mode.padEnd(24)} ${formatDuration(duration)}`);
  }
  console.log(`  ${'─'.repeat(46)}`);
  console.log(`  ${'Total'.padEnd(24)} ${formatDuration(runDuration)}`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`\nResults in: ${outDir}`);
}

if (totalRuns > 1) {
  const totalDuration = performance.now() - totalStart;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ALL ${totalRuns} RUNS COMPLETED in ${formatDuration(totalDuration)}`);
  console.log(`${'═'.repeat(50)}`);
}
