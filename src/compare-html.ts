import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BenchmarkResult, IdMode } from './types.js';

interface Environment {
  nodeVersion?: string;
  platform?: string;
  cpu?: string;
  cpuCores?: number;
  totalMemoryGB?: number;
  mongoVersion?: string;
  mongoUri?: string;
}

interface ResultFile {
  mode: IdMode;
  timestamp: string;
  environment?: Environment;
  results: BenchmarkResult[];
}

function loadResults(dir: string): ResultFile[] {
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.error(`No result files found in ${dir}`);
    process.exit(1);
  }

  const byMode = new Map<string, ResultFile>();
  for (const f of files) {
    const data: ResultFile = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
    byMode.set(data.mode, data);
  }

  return [...byMode.values()].sort((a, b) => a.mode.localeCompare(b.mode));
}

function fmt(n: number): string {
  if (n >= 1000) return Math.round(n).toLocaleString();
  return n.toFixed(2);
}

function fmtBytes(n: number): string {
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

function pctDiff(base: number, compare: number): number {
  if (base === 0) return 0;
  return ((compare - base) / base) * 100;
}

const dir = process.argv[2] || './results';
const resultFiles = loadResults(dir);

if (resultFiles.length < 2) {
  console.error('Need at least 2 result files to compare.');
  process.exit(1);
}

const modes = resultFiles.map(r => r.mode);
const benchNames = resultFiles[0].results.map(r => r.name);
const baseMode = 'objectid';

// Build groups from benchmark registry order
const GROUP_DEFS: [string, string[]][] = [
  ['Individual Write', ['Individual Inserts', 'Upserts']],
  ['Bulk Write', ['Unordered Bulk Inserts', 'Ordered Bulk Inserts']],
  ['Read', benchNames.filter(n =>
    ['Find by _id', 'Find by _id $in', 'Range Scan on _id', 'Cursor Pagination (_id)',
     'Cursor Pagination (createdAt + _id)', 'Count Documents', 'Random Access by _id'].includes(n))],
  ['Query', benchNames.filter(n =>
    ['Secondary Index Query (score)', 'Sort by _id', 'Compound Sort (createdAt + _id)', 'Aggregation Pipeline'].includes(n))],
  ['Update / Delete', benchNames.filter(n =>
    ['Update by _id', 'Update Many (range)', 'Delete by _id', 'Delete Many (range)'].includes(n))],
  ['Index & Storage', ['Index & Storage Size']],
  ['Sustained', ['Sustained Writes', 'Mixed Workload (70/30 read/write)']],
];

// Filter to only groups that have data
const groups = GROUP_DEFS.filter(([, benchList]) => benchList.length > 0);

const MODE_COLORS: Record<string, string> = {
  'objectid': '#10b981',
  'uuid7': '#3b82f6',
  'uuid7-string': '#8b5cf6',
  'uuid4': '#f59e0b',
  'autoincrement': '#ef4444',
  'autoincrement-string': '#ec4899',
};

const MODE_LABELS: Record<string, string> = {
  'objectid': 'ObjectId',
  'uuid7': 'UUID v7 (Binary)',
  'uuid7-string': 'UUID v7 (String)',
  'uuid4': 'UUID v4',
  'autoincrement': 'Auto-increment (Number)',
  'autoincrement-string': 'Auto-increment (String)',
};

function getValue(mode: string, benchName: string, field: 'opsPerSec' | 'p50' | 'p95' | 'p99'): number {
  const rf = resultFiles.find(r => r.mode === mode);
  const bench = rf?.results.find(r => r.name === benchName);
  if (!bench) return 0;
  if (field === 'opsPerSec') return bench.opsPerSec;
  return bench.latency[field];
}

function getMetadata(mode: string, benchName: string): Record<string, unknown> | undefined {
  const rf = resultFiles.find(r => r.mode === mode);
  return rf?.results.find(r => r.name === benchName)?.metadata;
}

function diffClass(pct: number, inverted = false): string {
  const effective = inverted ? -pct : pct;
  if (Math.abs(pct) < 2) return 'neutral';
  return effective > 0 ? 'better' : 'worse';
}

function buildComparisonTable(field: 'opsPerSec' | 'p50' | 'p95' | 'p99', benchList: string[]): string {
  const higherIsBetter = field === 'opsPerSec';
  let rows = '';

  for (const benchName of benchList) {
    const baseVal = getValue(baseMode, benchName, field);
    let cells = `<td class="bench-name">${benchName}</td>`;

    for (const mode of modes) {
      const val = getValue(mode, benchName, field);
      const isBase = mode === baseMode;
      const pct = isBase ? 0 : pctDiff(baseVal, val);
      const cls = isBase ? '' : diffClass(pct, !higherIsBetter);
      const pctStr = isBase ? '' : `<span class="pct ${cls}">${pct > 0 ? '+' : ''}${pct.toFixed(1)}%</span>`;

      cells += `<td class="metric-cell">${fmt(val)}${field !== 'opsPerSec' ? '<small>ms</small>' : ''}${pctStr}</td>`;
    }

    rows += `<tr>${cells}</tr>`;
  }

  return rows;
}

function buildStorageSection(): string {
  let html = '<div class="storage-grid">';

  for (const mode of modes) {
    const meta = getMetadata(mode, 'Index & Storage Size');
    if (!meta) continue;

    const color = MODE_COLORS[mode] || '#888';
    const label = MODE_LABELS[mode] || mode;

    html += `
    <div class="storage-card" style="border-top: 3px solid ${color}">
      <h4>${label}</h4>
      <div class="storage-stats">
        <div class="stat-row"><span class="stat-label">Avg Doc Size</span><span class="stat-value">${(meta.avgObjSize as number)} B</span></div>
        <div class="stat-row"><span class="stat-label">Storage Size</span><span class="stat-value">${fmtBytes(meta.storageSize as number)}</span></div>
        <div class="stat-row"><span class="stat-label">Total Index Size</span><span class="stat-value">${fmtBytes(meta.totalIndexSize as number)}</span></div>
      </div>`;

    if (meta.indexSizes && typeof meta.indexSizes === 'object') {
      html += '<div class="index-breakdown"><h5>Index Breakdown</h5>';
      for (const [name, size] of Object.entries(meta.indexSizes as Record<string, number>)) {
        html += `<div class="stat-row"><span class="stat-label">${name}</span><span class="stat-value">${fmtBytes(size)}</span></div>`;
      }
      html += '</div>';
    }

    html += '</div>';
  }

  html += '</div>';
  return html;
}

function buildSustainedSection(): string {
  let html = '<div class="sustained-grid">';

  for (const mode of modes) {
    const color = MODE_COLORS[mode] || '#888';
    const label = MODE_LABELS[mode] || mode;
    const swMeta = getMetadata(mode, 'Sustained Writes');
    const mwMeta = getMetadata(mode, 'Mixed Workload (70/30 read/write)');
    const swOps = getValue(mode, 'Sustained Writes', 'opsPerSec');
    const mwOps = getValue(mode, 'Mixed Workload (70/30 read/write)', 'opsPerSec');

    html += `
    <div class="sustained-card" style="border-top: 3px solid ${color}">
      <h4>${label}</h4>
      <div class="sustained-stats">
        <div class="sustained-metric">
          <span class="metric-title">Sustained Writes</span>
          <span class="metric-big">${fmt(swOps)}</span>
          <span class="metric-unit">ops/sec</span>
        </div>`;

    if (swMeta) {
      html += `<div class="stat-row"><span class="stat-label">Avg Throughput</span><span class="stat-value">${(swMeta.avgThroughput as number).toLocaleString()} ops/sec</span></div>`;
    }

    html += `
        <div class="sustained-metric" style="margin-top: 1rem">
          <span class="metric-title">Mixed Workload</span>
          <span class="metric-big">${fmt(mwOps)}</span>
          <span class="metric-unit">ops/sec</span>
        </div>`;

    if (mwMeta) {
      html += `
        <div class="stat-row"><span class="stat-label">Read ops</span><span class="stat-value">${(mwMeta.readOps as number).toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-label">Write ops</span><span class="stat-value">${(mwMeta.writeOps as number).toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-label">Read p99</span><span class="stat-value">${(mwMeta.readP99 as number).toFixed(3)}ms</span></div>
        <div class="stat-row"><span class="stat-label">Write p99</span><span class="stat-value">${(mwMeta.writeP99 as number).toFixed(3)}ms</span></div>`;
    }

    html += '</div></div>';
  }

  html += '</div>';
  return html;
}

function buildBarChartData(benchList: string[], field: 'opsPerSec' | 'p50' | 'p99'): string {
  const datasets = modes.map(mode => {
    const color = MODE_COLORS[mode] || '#888';
    const data = benchList.map(b => getValue(mode, b, field));
    return `{ label: '${MODE_LABELS[mode] || mode}', data: [${data.join(',')}], backgroundColor: '${color}cc', borderColor: '${color}', borderWidth: 1 }`;
  });

  return `[${datasets.join(',')}]`;
}

// Environment info from first result file that has it
const env = resultFiles.find(r => r.environment)?.environment;

function buildEnvSection(): string {
  if (!env) return '';
  const items: string[] = [];
  if (env.mongoVersion && env.mongoVersion !== 'unknown') items.push(`MongoDB ${env.mongoVersion}`);
  if (env.nodeVersion) items.push(`Node ${env.nodeVersion}`);
  if (env.cpu) items.push(env.cpu);
  if (env.cpuCores) items.push(`${env.cpuCores} cores`);
  if (env.totalMemoryGB) items.push(`${env.totalMemoryGB} GB RAM`);
  if (env.platform) items.push(env.platform);
  if (env.mongoUri) items.push(env.mongoUri.includes('mongodb+srv') ? 'Atlas cluster' : 'Local MongoDB');
  if (items.length === 0) return '';
  return `<div class="env-info">${items.join(' &middot; ')}</div>`;
}

const timestamp = new Date().toISOString().replace('T', ' ').replace(/\..+/, ' UTC');

// Chart definitions: [id, title, benchList, field]
type ChartDef = [string, string, string[], 'opsPerSec' | 'p50' | 'p99'];
const charts: ChartDef[] = [
  ['chart-individual-ops', 'Individual Write — Ops/sec', ['Individual Inserts', 'Upserts'], 'opsPerSec'],
  ['chart-bulk-ops', 'Bulk Write — Ops/sec', ['Unordered Bulk Inserts', 'Ordered Bulk Inserts'], 'opsPerSec'],
  ['chart-read-ops', 'Read — Ops/sec', groups.find(([g]) => g === 'Read')?.[1] ?? [], 'opsPerSec'],
  ['chart-query-ops', 'Query — Ops/sec', groups.find(([g]) => g === 'Query')?.[1] ?? [], 'opsPerSec'],
  ['chart-ud-ops', 'Update/Delete — Ops/sec', groups.find(([g]) => g === 'Update / Delete')?.[1] ?? [], 'opsPerSec'],
  ['chart-read-p99', 'Read — p99 Latency (ms)', groups.find(([g]) => g === 'Read')?.[1] ?? [], 'p99'],
  ['chart-query-p99', 'Query — p99 Latency (ms)', groups.find(([g]) => g === 'Query')?.[1] ?? [], 'p99'],
  ['chart-individual-p99', 'Individual Write — p99 Latency (ms)', ['Individual Inserts', 'Upserts'], 'p99'],
];

const legendOpts = `{
  display: true,
  position: 'bottom',
  labels: {
    boxWidth: 12,
    padding: 12,
    font: { size: 10 },
    usePointStyle: true,
    pointStyle: 'rectRounded'
  }
}`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MongoDB ID Strategy Benchmark Comparison</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    :root {
      --bg: #0f1117;
      --bg2: #1a1d27;
      --bg3: #242836;
      --border: #2e3348;
      --text: #e4e7f0;
      --text2: #9198ad;
      --text3: #5d6480;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 2rem 1.5rem; }

    header { text-align: center; margin-bottom: 2rem; }
    header h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.3rem; }
    header p { color: var(--text2); font-size: 0.9rem; }

    .env-info {
      text-align: center; color: var(--text3); font-size: 0.8rem;
      margin-bottom: 2rem; padding: 0.5rem;
    }

    .legend {
      display: flex; flex-wrap: wrap; justify-content: center; gap: 1.2rem;
      margin-bottom: 2rem; padding: 1rem; background: var(--bg2);
      border-radius: 12px; border: 1px solid var(--border);
    }
    .legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; }
    .legend-dot { width: 12px; height: 12px; border-radius: 3px; }
    .legend-base { font-size: 0.7rem; color: var(--text3); margin-left: 0.2rem; }

    section { margin-bottom: 3rem; }
    section h2 {
      font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem;
      padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);
    }
    section h3 { font-size: 1rem; font-weight: 500; color: var(--text2); margin-bottom: 0.75rem; }

    .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
    .chart-box {
      background: var(--bg2); border-radius: 12px; border: 1px solid var(--border);
      padding: 1.25rem;
    }
    .chart-wrap { position: relative; height: 300px; }
    .chart-box h3 { margin-bottom: 0.5rem; }

    table {
      width: 100%; border-collapse: collapse; font-size: 0.82rem;
      background: var(--bg2); border-radius: 12px; overflow: hidden;
      border: 1px solid var(--border);
    }
    thead th {
      background: var(--bg3); padding: 0.7rem 0.6rem; text-align: right;
      font-weight: 600; color: var(--text2); white-space: nowrap;
      border-bottom: 2px solid var(--border);
    }
    thead th:first-child { text-align: left; }
    tbody td {
      padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--border);
      text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    tbody td.bench-name { text-align: left; font-weight: 500; color: var(--text); }
    tbody td small { color: var(--text3); margin-left: 1px; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: var(--bg3); }

    .pct {
      display: inline-block; font-size: 0.7rem; margin-left: 0.35rem;
      padding: 0.1rem 0.35rem; border-radius: 4px; font-weight: 600;
    }
    .pct.better { color: #34d399; background: #34d39915; }
    .pct.worse { color: #f87171; background: #f8717115; }
    .pct.neutral { color: var(--text3); background: transparent; }

    .metric-cell { min-width: 110px; }

    .storage-grid, .sustained-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;
    }
    .storage-card, .sustained-card {
      background: var(--bg2); border-radius: 12px; border: 1px solid var(--border);
      padding: 1.25rem;
    }
    .storage-card h4, .sustained-card h4 { font-size: 0.9rem; margin-bottom: 0.75rem; }
    .storage-card h5 { font-size: 0.75rem; color: var(--text3); margin: 0.75rem 0 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-row { display: flex; justify-content: space-between; padding: 0.25rem 0; font-size: 0.8rem; }
    .stat-label { color: var(--text2); }
    .stat-value { font-weight: 600; font-variant-numeric: tabular-nums; }

    .sustained-metric { text-align: center; margin-bottom: 0.5rem; }
    .metric-title { display: block; color: var(--text2); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric-big { display: block; font-size: 1.6rem; font-weight: 700; line-height: 1.3; }
    .metric-unit { font-size: 0.7rem; color: var(--text3); }

    .note {
      background: var(--bg2); border: 1px solid var(--border); border-radius: 8px;
      padding: 0.75rem 1rem; font-size: 0.8rem; color: var(--text2); margin-bottom: 1.5rem;
    }
    .note strong { color: var(--text); }

    .methodology {
      background: var(--bg2); border: 1px solid var(--border); border-radius: 8px;
      padding: 1rem 1.25rem; font-size: 0.8rem; color: var(--text2); margin-bottom: 1.5rem;
      line-height: 1.7;
    }
    .methodology strong { color: var(--text); }
    .methodology ul { margin: 0.5rem 0; padding-left: 1.2rem; }

    @media (max-width: 900px) {
      .chart-row { grid-template-columns: 1fr; }
      table { font-size: 0.75rem; }
      .storage-grid, .sustained-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 600px) {
      .storage-grid, .sustained-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>MongoDB _id Strategy Benchmark</h1>
    <p>Comparing ${modes.length} ID strategies across ${benchNames.length} benchmarks &middot; ${resultFiles[0].results.find(r => r.name === 'Index & Storage Size')?.metadata?.count?.toLocaleString() ?? '100,000'} seeded documents &middot; ${timestamp}</p>
  </header>

  ${buildEnvSection()}

  <div class="legend">
    ${modes.map(m => `<div class="legend-item"><div class="legend-dot" style="background:${MODE_COLORS[m] || '#888'}"></div>${MODE_LABELS[m] || m}${m === baseMode ? '<span class="legend-base">(baseline)</span>' : ''}</div>`).join('')}
  </div>

  <div class="methodology">
    <strong>Methodology:</strong> Each mode seeds the same collection structure (documents with username, email, score, status, tags, timestamps, metadata) then runs identical benchmarks. ID generation cost is included in write measurements — this is intentional, as auto-increment modes pay a real DB round-trip per ID via <code>findOneAndUpdate</code>. Bulk operations use batch ID allocation (one DB call per batch). Mode execution order is randomized to eliminate first-mover cache bias. Write concern is default (<code>w:1</code>).
    <ul>
      <li><strong>Individual Write:</strong> Single-document inserts and upserts — shows per-operation overhead including ID generation</li>
      <li><strong>Bulk Write:</strong> insertMany in batches of 5,000 — ID generation excluded from timing, measures pure insert throughput</li>
      <li><strong>Read/Query:</strong> Point lookups, range scans, pagination, aggregation — measures index efficiency by ID type</li>
      <li><strong>Sustained:</strong> 30-second continuous write + mixed read/write with 10 concurrent workers</li>
    </ul>
  </div>

  <div class="note"><strong>Reading the tables:</strong> Percentages show difference vs ObjectId (baseline). For ops/sec, <span class="pct better">green = faster</span>. For latency, <span class="pct better">green = lower (faster)</span>, <span class="pct worse">red = higher (slower)</span>.</div>

  <!-- CHARTS -->
  <section>
    <h2>Visual Overview</h2>
    ${charts.reduce((acc, [id, title], i) => {
      const isFirst = i % 2 === 0;
      const isLast = i % 2 === 1 || i === charts.length - 1;
      let s = '';
      if (isFirst) s += '<div class="chart-row">';
      s += `<div class="chart-box"><h3>${title}</h3><div class="chart-wrap"><canvas id="${id}"></canvas></div></div>`;
      if (isLast) s += '</div>';
      return acc + s;
    }, '')}
  </section>

  ${groups.filter(([g]) => g !== 'Index & Storage' && g !== 'Sustained').map(([groupName, benchList]) => `
  <section>
    <h2>${groupName} — Ops/sec</h2>
    <table>
      <thead><tr><th>Benchmark</th>${modes.map(m => `<th>${MODE_LABELS[m] || m}</th>`).join('')}</tr></thead>
      <tbody>${buildComparisonTable('opsPerSec', benchList)}</tbody>
    </table>
  </section>
  <section>
    <h2>${groupName} — p50 Latency</h2>
    <table>
      <thead><tr><th>Benchmark</th>${modes.map(m => `<th>${MODE_LABELS[m] || m}</th>`).join('')}</tr></thead>
      <tbody>${buildComparisonTable('p50', benchList)}</tbody>
    </table>
  </section>
  <section>
    <h2>${groupName} — p99 Latency</h2>
    <table>
      <thead><tr><th>Benchmark</th>${modes.map(m => `<th>${MODE_LABELS[m] || m}</th>`).join('')}</tr></thead>
      <tbody>${buildComparisonTable('p99', benchList)}</tbody>
    </table>
  </section>
  `).join('')}

  <section>
    <h2>Index & Storage</h2>
    ${buildStorageSection()}
  </section>

  <section>
    <h2>Sustained Workloads</h2>
    ${buildSustainedSection()}
  </section>
</div>

<script>
  Chart.defaults.color = '#9198ad';
  Chart.defaults.borderColor = '#2e3348';
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif";
  Chart.defaults.font.size = 11;

  const defaultOpts = (yTitle) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: ${legendOpts},
      tooltip: {
        callbacks: {
          label: (ctx) => ctx.dataset.label + ': ' + Number(ctx.raw).toLocaleString(undefined, { maximumFractionDigits: 2 }) + (yTitle ? ' ' + yTitle : '')
        }
      }
    },
    scales: {
      x: { ticks: { maxRotation: 45, font: { size: 10 } }, grid: { display: false } },
      y: {
        beginAtZero: true,
        title: yTitle ? { display: true, text: yTitle } : undefined,
        ticks: { callback: v => v >= 1000 ? (v/1000).toFixed(0) + 'K' : v }
      }
    }
  });

  ${charts.map(([id, , benchList, field]) => {
    const yTitle = field === 'opsPerSec' ? '' : 'ms';
    return `new Chart(document.getElementById('${id}'), {
    type: 'bar',
    data: { labels: ${JSON.stringify(benchList)}, datasets: ${buildBarChartData(benchList, field)} },
    options: defaultOpts(${yTitle ? `'${yTitle}'` : 'null'})
  });`;
  }).join('\n\n  ')}
</script>
</body>
</html>`;

const outPath = join(dir, 'comparison.html');
writeFileSync(outPath, html);
console.log(`HTML comparison written to: ${outPath}`);
