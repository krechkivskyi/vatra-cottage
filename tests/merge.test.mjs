import assert from 'node:assert/strict';
import { mergeIntervals } from '../scripts/fetch-ical.mjs';

/**
 * @returns {{start: Date, end: Date}}
 */
function interval(start, end) {
  return { start: new Date(start), end: new Date(end) };
}

export const tests = [
  {
    name: 'mergeIntervals merges overlapping and adjacent intervals',
    fn: () => {
      const merged = mergeIntervals([
        interval('2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z'),
        interval('2024-01-01T10:30:00Z', '2024-01-01T12:00:00Z'),
        interval('2024-01-02T08:00:00Z', '2024-01-02T09:00:00Z'),
        interval('2024-01-02T09:00:00Z', '2024-01-02T10:00:00Z')
      ]);

      assert.equal(merged.length, 2);
      assert.equal(merged[0].start.toISOString(), '2024-01-01T10:00:00.000Z');
      assert.equal(merged[0].end.toISOString(), '2024-01-01T12:00:00.000Z');
      assert.equal(merged[1].start.toISOString(), '2024-01-02T08:00:00.000Z');
      assert.equal(merged[1].end.toISOString(), '2024-01-02T10:00:00.000Z');
    }
  },
  {
    name: 'mergeIntervals ignores empty input',
    fn: () => {
      const merged = mergeIntervals([]);
      assert.deepEqual(merged, []);
    }
  }
];
