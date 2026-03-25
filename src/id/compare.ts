import { Binary, ObjectId } from 'mongodb';
import type { GeneratedId } from '../types.js';

/**
 * Compare two GeneratedId values in the same order MongoDB uses for the _id index.
 * - ObjectId: hex string comparison (matches byte order)
 * - Binary: raw buffer byte-by-byte comparison
 * - number: numeric comparison
 * - string: lexicographic comparison
 */
export function compareIds(a: GeneratedId, b: GeneratedId): number {
  if (a instanceof Binary && b instanceof Binary) {
    return Buffer.compare(a.buffer, b.buffer);
  }
  if (a instanceof ObjectId && b instanceof ObjectId) {
    return a.toString().localeCompare(b.toString());
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  // strings and anything else: default lexicographic
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function sortIds(ids: GeneratedId[]): GeneratedId[] {
  return [...ids].sort(compareIds);
}
