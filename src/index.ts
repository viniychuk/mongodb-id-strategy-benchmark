import { parseConfig } from './config.js';
import { runBenchmarks } from './runner.js';

const config = parseConfig(process.argv.slice(2));
await runBenchmarks(config);
