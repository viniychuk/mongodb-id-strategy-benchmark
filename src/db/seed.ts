import { faker } from '@faker-js/faker';
import type { Collection } from 'mongodb';
import type { IdStrategy, GeneratedId, BenchDoc } from '../types.js';

const STATUSES = ['active', 'inactive', 'pending'] as const;
const REGIONS = ['us-east', 'us-west', 'eu-west', 'eu-central', 'ap-southeast', 'ap-northeast'];
const TAG_POOL = ['premium', 'trial', 'enterprise', 'beta', 'internal', 'verified', 'flagged', 'vip'];

function generateDoc(id: GeneratedId, index: number) {
  const tagCount = 1 + (index % 5);
  const tags: string[] = [];
  for (let t = 0; t < tagCount; t++) {
    tags.push(TAG_POOL[(index + t) % TAG_POOL.length]);
  }

  const now = new Date();
  const createdAt = new Date(now.getTime() - (100_000 - index) * 1000);

  return {
    _id: id,
    username: faker.internet.username() + index,
    email: `user${index}@bench${faker.number.int({ min: 0, max: 999 })}.test`,
    score: faker.number.int({ min: 0, max: 10000 }),
    status: STATUSES[index % 3],
    tags,
    createdAt,
    updatedAt: createdAt,
    metadata: {
      ip: faker.internet.ipv4(),
      userAgent: faker.internet.userAgent(),
      region: REGIONS[index % REGIONS.length],
    },
  };
}

export async function seedCollection(
  collection: Collection<BenchDoc>,
  idStrategy: IdStrategy,
  count: number,
  logProgress = true,
): Promise<GeneratedId[]> {
  faker.seed(42);

  const ids: GeneratedId[] = [];
  const BATCH = 5000;

  for (let offset = 0; offset < count; offset += BATCH) {
    const batchSize = Math.min(BATCH, count - offset);
    // Use batch allocation (single DB call for autoincrement, local loop for others)
    const batchIds = await idStrategy.generateBatch(batchSize);
    const docs = [];
    for (let i = 0; i < batchSize; i++) {
      ids.push(batchIds[i]);
      docs.push(generateDoc(batchIds[i], offset + i));
    }
    await collection.insertMany(docs, { ordered: false });

    if (logProgress && (offset + batchSize) % 25_000 === 0) {
      console.log(`  Seeded ${offset + batchSize}/${count}`);
    }
  }

  return ids;
}
