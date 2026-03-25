import { ObjectId, Binary, UUID } from 'mongodb';
import type { Collection, Document } from 'mongodb';
import { v7 as uuidv7 } from 'uuid';
import type { IdMode, IdStrategy, GeneratedId } from '../types.js';

interface CounterDoc extends Document {
  _id: string;
  seq: number;
}

const COUNTER_KEY = 'autoincrement';

function toId(mode: 'autoincrement' | 'autoincrement-string', n: number): GeneratedId {
  return mode === 'autoincrement-string' ? String(n) : n;
}

function createAutoincrementStrategy(mode: 'autoincrement' | 'autoincrement-string', counters: Collection<CounterDoc>): IdStrategy {
  return {
    mode,

    async generate() {
      const result = await counters.findOneAndUpdate(
        { _id: COUNTER_KEY },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true },
      );
      return toId(mode, result!.seq);
    },

    async generateBatch(count: number) {
      const result = await counters.findOneAndUpdate(
        { _id: COUNTER_KEY },
        { $inc: { seq: count } },
        { returnDocument: 'after', upsert: true },
      );
      const end = result!.seq;
      const start = end - count + 1;
      const ids: GeneratedId[] = [];
      for (let i = start; i <= end; i++) {
        ids.push(toId(mode, i));
      }
      return ids;
    },
  };
}

function simpleBatch(generate: () => GeneratedId, count: number): GeneratedId[] {
  const ids: GeneratedId[] = [];
  for (let i = 0; i < count; i++) ids.push(generate());
  return ids;
}

export function createIdStrategy(mode: IdMode, countersCollection?: Collection<CounterDoc>): IdStrategy {
  switch (mode) {
    case 'objectid': {
      const gen = () => new ObjectId();
      return { mode, generate: gen, generateBatch: (n) => simpleBatch(gen, n) };
    }

    case 'uuid7': {
      const gen = () => {
        const bytes = new Uint8Array(16);
        uuidv7(undefined, bytes);
        return new Binary(Buffer.from(bytes), Binary.SUBTYPE_UUID);
      };
      return { mode, generate: gen, generateBatch: (n) => simpleBatch(gen, n) };
    }

    case 'uuid7-string': {
      const gen = () => uuidv7();
      return { mode, generate: gen, generateBatch: (n) => simpleBatch(gen, n) };
    }

    case 'uuid4': {
      const gen = () => new UUID();
      return { mode, generate: gen, generateBatch: (n) => simpleBatch(gen, n) };
    }

    case 'autoincrement':
    case 'autoincrement-string':
      if (!countersCollection) throw new Error('autoincrement modes require a counters collection');
      return createAutoincrementStrategy(mode, countersCollection);
  }
}
