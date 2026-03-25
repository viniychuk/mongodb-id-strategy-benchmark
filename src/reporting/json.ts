import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { platform, arch, cpus, totalmem } from 'node:os';
import type { BenchmarkResult, IdMode } from '../types.js';

function getEnvironment(mongoUri: string) {
  let mongoVersion = 'unknown';
  try {
    // Try to get MongoDB version from the server via mongosh or the connection
    mongoVersion = execFileSync('mongosh', ['--quiet', '--eval', 'db.version()', mongoUri], {
      timeout: 5000,
    }).toString().trim();
  } catch {
    // If mongosh isn't available, we'll report unknown
  }

  return {
    nodeVersion: process.version,
    platform: `${platform()} ${arch()}`,
    cpu: cpus()[0]?.model ?? 'unknown',
    cpuCores: cpus().length,
    totalMemoryGB: Math.round(totalmem() / (1024 ** 3)),
    mongoVersion,
    mongoUri: mongoUri.replace(/\/\/[^@]+@/, '//***:***@'), // redact credentials
  };
}

export function writeResults(results: BenchmarkResult[], mode: IdMode, outputDir: string, mongoUri = ''): string {
  mkdirSync(outputDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${mode}-${ts}.json`;
  const filepath = join(outputDir, filename);

  const data = {
    mode,
    timestamp: new Date().toISOString(),
    environment: getEnvironment(mongoUri),
    results,
  };

  writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}
