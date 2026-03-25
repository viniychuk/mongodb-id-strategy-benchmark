import type { LatencyStats } from '../types.js';

export function computeStats(samples: Float64Array, count: number): LatencyStats {
  if (count === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const slice = samples.subarray(0, count);
  slice.sort();

  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += slice[i];
  }

  return {
    min: slice[0],
    max: slice[count - 1],
    avg: sum / count,
    p50: slice[Math.floor(count * 0.5)],
    p95: slice[Math.floor(count * 0.95)],
    p99: slice[Math.floor(count * 0.99)],
  };
}
