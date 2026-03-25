import { MongoClient } from 'mongodb';

export async function createClient(uri: string): Promise<MongoClient> {
  const client = new MongoClient(uri, { maxPoolSize: 50 });
  await client.connect();
  return client;
}
