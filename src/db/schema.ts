import type { Collection } from 'mongodb';
import type { BenchDoc } from '../types.js';

export async function createIndexes(collection: Collection<BenchDoc>): Promise<void> {
  await collection.createIndex({ username: 1 });
  await collection.createIndex({ email: 1 }, { unique: true });
  await collection.createIndex({ score: 1 });
  await collection.createIndex({ status: 1 });
  await collection.createIndex({ createdAt: 1 });
  await collection.createIndex({ createdAt: 1, _id: 1 });
}
