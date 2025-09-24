import assert from 'node:assert/strict';
import { filterIntervals } from '../scripts/fetch-ical.mjs';

/**
 * @returns {{start: Date, end: Date}}
 */
function interval(start, end) {
  return { start: new Date(start), end: new Date(end) };
}

export const tests = [
  {
    name: 'filterIntervals removes ranges outside the window and clamps overlaps',
    fn: () => {
      const rangeStart = new Date('2024-03-01T00:00:00Z');
      const rangeEnd = new Date('2024-03-10T00:00:00Z');

      const filtered = filterIntervals([
        interval('2024-02-25T00:00:00Z', '2024-03-02T00:00:00Z'),
        interval('2024-03-05T12:00:00Z', '2024-03-06T12:00:00Z'),
        interval('2024-03-09T23:00:00Z', '2024-03-15T12:00:00Z')
      ], rangeStart, rangeEnd);

      assert.equal(filtered.length, 3);
      assert.equal(filtered[0].start.toISOString(), rangeStart.toISOString());
      assert.equal(filtered[0].end.toISOString(), '2024-03-02T00:00:00.000Z');
      assert.equal(filtered[2].start.toISOString(), '2024-03-09T23:00:00.000Z');
      assert.equal(filtered[2].end.toISOString(), rangeEnd.toISOString());
    }
  },
  {
    name: 'filterIntervals drops intervals with no overlap',
    fn: () => {
      const rangeStart = new Date('2024-03-01T00:00:00Z');
      const rangeEnd = new Date('2024-03-10T00:00:00Z');

      const filtered = filterIntervals([
        interval('2023-01-01T00:00:00Z', '2023-01-02T00:00:00Z'),
        interval('2024-03-10T00:00:00Z', '2024-03-11T00:00:00Z')
      ], rangeStart, rangeEnd);

      assert.equal(filtered.length, 0);
    }
  }
];
