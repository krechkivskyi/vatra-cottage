import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { URL, pathToFileURL } from 'node:url';
import ical from 'node-ical';

const PAST_DAYS = 30;
const FUTURE_DAYS = 365;
const OUTPUT_RANGE_DAYS = 730;
const FETCH_TIMEOUT_MS = 10000;
const MAX_RETRIES = 1;
const MAX_REDIRECTS = 3;

const CALENDARS = [
  { env: 'BOOKING_CALENDAR_1', name: 'cottage1' },
  { env: 'BOOKING_CALENDAR_2', name: 'cottage2' }
];

/**
 * Downloads an ICS feed with retries.
 * @param {string} url
 * @param {string} envName
 * @returns {Promise<string>}
 */
async function downloadCalendar(url, envName) {
  let attempt = 0;
  let lastError;
  while (attempt <= MAX_RETRIES) {
    try {
      return await requestOnce(url, MAX_REDIRECTS);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${envName}] Attempt ${attempt + 1} failed: ${message}`);
      attempt += 1;
      if (attempt > MAX_RETRIES) {
        break;
      }
    }
  }
  throw lastError ?? new Error('Unknown download failure');
}

/**
 * Executes a single HTTP(S) request with redirects.
 * @param {string} url
 * @param {number} redirectsRemaining
 * @returns {Promise<string>}
 */
function requestOnce(url, redirectsRemaining) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const isHttps = target.protocol === 'https:';
    const requestLib = isHttps ? https : http;

    const options = {
      method: 'GET',
      headers: {
        'User-Agent': 'booking-ical-sanitizer/1.0',
        'Accept': 'text/calendar, text/plain;q=0.9, */*;q=0.8'
      },
      timeout: FETCH_TIMEOUT_MS
    };

    if (isHttps) {
      options.rejectUnauthorized = true;
    }

    const req = requestLib.request(target, options, (res) => {
      if (res.statusCode && [301, 302, 307, 308].includes(res.statusCode)) {
        if (!res.headers.location) {
          res.resume();
          reject(new Error(`Redirect without Location header (status ${res.statusCode})`));
          return;
        }
        if (redirectsRemaining <= 0) {
          res.resume();
          reject(new Error('Too many redirects'));
          return;
        }
        const nextUrl = new URL(res.headers.location, target);
        res.resume();
        resolve(requestOnce(nextUrl.toString(), redirectsRemaining - 1));
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Unexpected status ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.setEncoding('utf8');
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        resolve(chunks.join(''));
      });
    });

    req.setTimeout(FETCH_TIMEOUT_MS, () => {
      req.destroy(new Error('Request timed out'));
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Parses busy intervals from raw ICS data.
 * @param {string} icsData
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @returns {{start: Date, end: Date}[]}
 */
function extractBusyIntervals(icsData, rangeStart, rangeEnd) {
  let parsed;
  try {
    parsed = ical.sync.parseICS(icsData);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ICS data: ${message}`);
  }

  /** @type {{start: Date, end: Date}[]} */
  const intervals = [];

  for (const component of Object.values(parsed)) {
    if (!component || component.type !== 'VEVENT') {
      continue;
    }
    collectOccurrences(component, rangeStart, rangeEnd, intervals);
  }

  return intervals;
}

/**
 * Adds occurrences of an event into the result array.
 * @param {any} event
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @param {{start: Date, end: Date}[]} result
 */
function collectOccurrences(event, rangeStart, rangeEnd, result) {
  const baseStart = toDate(event.start);
  const baseEnd = toDate(event.end);
  const durationMs = computeDuration(event, baseStart, baseEnd);

  const pushInterval = (start, end) => {
    if (!(start instanceof Date) || Number.isNaN(start.valueOf())) return;
    if (!(end instanceof Date) || Number.isNaN(end.valueOf())) return;
    if (end <= start) return;
    if (end <= rangeStart || start >= rangeEnd) return;

    const clampedStart = new Date(Math.max(start.getTime(), rangeStart.getTime()));
    const clampedEnd = new Date(Math.min(end.getTime(), rangeEnd.getTime()));
    if (clampedEnd <= clampedStart) {
      return;
    }
    result.push({ start: clampedStart, end: clampedEnd });
  };

  const exdates = new Set(
    event.exdate ? Object.values(event.exdate).map((date) => toDate(date)?.getTime()) : []
  );

  if (event.rrule) {
    const expandedStart = new Date(rangeStart.getTime() - durationMs);
    const between = event.rrule.between(expandedStart, rangeEnd, true);
    for (const occurrenceStart of between) {
      if (exdates.has(occurrenceStart.getTime())) {
        continue;
      }
      const end = new Date(occurrenceStart.getTime() + durationMs);
      pushInterval(occurrenceStart, end);
    }
  }

  if (event.recurrences) {
    for (const recurrence of Object.values(event.recurrences)) {
      const recStart = toDate(recurrence.start);
      const recEnd = toDate(recurrence.end);
      const end = recEnd ?? (recStart ? new Date(recStart.getTime() + durationMs) : undefined);
      if (!recStart || !end) {
        continue;
      }
      pushInterval(recStart, end);
    }
  }

  if (!event.rrule && !event.recurrences) {
    if (!baseStart) {
      return;
    }
    const endDate = baseEnd ?? (durationMs > 0 ? new Date(baseStart.getTime() + durationMs) : undefined);
    if (!endDate) {
      return;
    }
    pushInterval(baseStart, endDate);
  }
}

/**
 * Converts potential date input to a Date instance.
 * @param {unknown} value
 * @returns {Date | undefined}
 */
function toDate(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * Computes the duration in milliseconds for an event.
 * @param {any} event
 * @param {Date | undefined} baseStart
 * @param {Date | undefined} baseEnd
 * @returns {number}
 */
function computeDuration(event, baseStart, baseEnd) {
  if (baseStart && baseEnd) {
    const diff = baseEnd.getTime() - baseStart.getTime();
    if (diff > 0) {
      return diff;
    }
  }
  if (event && typeof event.duration === 'object' && event.duration !== null) {
    if (typeof event.duration.toMilliseconds === 'function') {
      const ms = event.duration.toMilliseconds();
      if (typeof ms === 'number' && ms > 0) {
        return ms;
      }
    }
    if ('milliseconds' in event.duration) {
      const ms = Number(event.duration.milliseconds);
      if (Number.isFinite(ms) && ms > 0) {
        return ms;
      }
    }
  }
  return 0;
}

/**
 * Filters and merges overlapping intervals.
 * @param {{start: Date, end: Date}[]} intervals
 * @returns {{start: Date, end: Date}[]}
 */
export function mergeIntervals(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return [];
  }
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start.getTime() <= last.end.getTime()) {
      if (current.end.getTime() > last.end.getTime()) {
        last.end = current.end;
      }
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }
  return merged;
}

/**
 * Filters intervals to the requested range and clamps their bounds.
 * @param {{start: Date, end: Date}[]} intervals
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @returns {{start: Date, end: Date}[]}
 */
export function filterIntervals(intervals, rangeStart, rangeEnd) {
  return intervals
    .map(({ start, end }) => {
      const clampedStart = new Date(Math.max(start.getTime(), rangeStart.getTime()));
      const clampedEnd = new Date(Math.min(end.getTime(), rangeEnd.getTime()));
      return { start: clampedStart, end: clampedEnd };
    })
    .filter(({ start, end }) => end > start);
}

/**
 * Main execution flow for the script.
 */
export async function main() {
  const now = new Date();
  const rangeStart = new Date(now.getTime() - PAST_DAYS * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + FUTURE_DAYS * 24 * 60 * 60 * 1000);

  let successCount = 0;

  for (const calendar of CALENDARS) {
    const url = process.env[calendar.env];
    if (!url) {
      continue;
    }

    try {
      const ics = await downloadCalendar(url, calendar.env);
      if (!ics || !ics.trim()) {
        throw new Error('Empty calendar response');
      }
      const rawIntervals = extractBusyIntervals(ics, rangeStart, rangeEnd);
      const filtered = filterIntervals(rawIntervals, rangeStart, rangeEnd);
      const merged = mergeIntervals(filtered);
      await writeOutput(calendar.name, merged, now);
      console.log(`[${calendar.name}] Updated ${merged.length} busy intervals.`);
      successCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${calendar.env}] Failed: ${message}`);
    }
  }

  if (successCount === 0) {
    throw new Error('No calendars were updated successfully');
  }
}

/**
 * Writes sanitized output to the data directory.
 * @param {string} name
 * @param {{start: Date, end: Date}[]} intervals
 * @param {Date} now
 */
async function writeOutput(name, intervals, now) {
  const events = intervals.map(({ start, end }) => ({
    start: start.toISOString(),
    end: end.toISOString(),
    busy: true
  }));

  const payload = {
    updatedAt: now.toISOString(),
    events,
    source: 'booking-ical-sanitized',
    rangeDays: OUTPUT_RANGE_DAYS
  };

  const filePath = path.join('data', `busy-${name}.json`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

const invokedDirectly = Boolean(
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
);

if (invokedDirectly) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}

export { extractBusyIntervals };
