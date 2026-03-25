import { performance } from 'node:perf_hooks';
import { computeStats } from './histogram.js';
import type { LatencyStats } from '../types.js';

export class LatencyRecorder {
  private samples: Float64Array;
  private count = 0;

  constructor(capacity: number) {
    this.samples = new Float64Array(capacity);
  }

  async measure<T>(fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const durationMs = performance.now() - start;
    if (this.count < this.samples.length) {
      this.samples[this.count++] = durationMs;
    }
    return result;
  }

  recordDuration(ms: number): void {
    if (this.count < this.samples.length) {
      this.samples[this.count++] = ms;
    }
  }

  getStats(): LatencyStats {
    return computeStats(this.samples, this.count);
  }

  getCount(): number {
    return this.count;
  }
}

export function now(): number {
  return performance.now();
}
