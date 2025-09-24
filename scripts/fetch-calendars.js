#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const ICAL = require('ical.js');

const CALENDAR_ENV_PREFIX = 'BOOKING_CALENDAR_';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'data');
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_OCCURRENCES = 1000;
const YEARS_AHEAD_LIMIT = 2;

function formatDateKeyFromUtcTimestamp(timestamp) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normaliseCalendarName(rawName) {
  const trimmed = String(rawName || '').trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'calendar';
}

function getCalendarsFromEnv() {
  const calendars = Object.entries(process.env)
    .filter(([key, value]) => key.startsWith(CALENDAR_ENV_PREFIX) && value)
    .map(([key, value]) => ({
      key,
      name: normaliseCalendarName(key.slice(CALENDAR_ENV_PREFIX.length)),
      source: value.trim(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  if (calendars.length === 0) {
    throw new Error('Не знайдено жодного середовища BOOKING_CALENDAR_*');
  }

  return calendars;
}

async function readCalendarSource(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, {
      headers: {
        'User-Agent': 'vatra-cottage-calendar-fetcher/1.0',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  }

  const resolvedPath = path.isAbsolute(source)
    ? source
    : path.resolve(process.cwd(), source);
  return await fs.readFile(resolvedPath, 'utf8');
}

function isCancelled(component) {
  const status = component?.getFirstPropertyValue('status');
  return typeof status === 'string' && status.toUpperCase() === 'CANCELLED';
}

function* iterateOccurrences(event) {
  if (!event.isRecurring()) {
    yield {
      start: event.startDate,
      end: event.endDate,
      component: event.component,
    };
    return;
  }

  const iterator = event.iterator();
  const cutoff = ICAL.Time.fromJSDate(new Date(Date.now() + YEARS_AHEAD_LIMIT * 365 * MS_PER_DAY));
  let counter = 0;
  let next;
  while ((next = iterator.next())) {
    if (++counter > MAX_OCCURRENCES) {
      console.warn('Досягнуто ліміт повторень для одного з календарів. Подальші події пропущені.');
      break;
    }
    if (next.compare(cutoff) > 0) {
      break;
    }
    const occurrence = event.getOccurrenceDetails(next);
    yield {
      start: occurrence.startDate,
      end: occurrence.endDate,
      component: occurrence.item?.component || event.component,
    };
  }
}

function expandBusyDates(startTime, endTime) {
  const busyDates = [];
  const startDate = startTime.toJSDate();
  const endDate = endTime.toJSDate();

  const startUtc = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );
  let endUtc = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate()
  );

  if (endUtc <= startUtc) {
    endUtc = startUtc + MS_PER_DAY;
  }

  for (let ts = startUtc; ts < endUtc; ts += MS_PER_DAY) {
    busyDates.push(formatDateKeyFromUtcTimestamp(ts));
  }

  return busyDates;
}

function extractBusyData(icsText) {
  const busyDates = new Set();
  const intervals = [];

  const jcalData = ICAL.parse(icsText);
  const component = new ICAL.Component(jcalData);
  const events = component.getAllSubcomponents('vevent');

  for (const vevent of events) {
    const event = new ICAL.Event(vevent);

    for (const occurrence of iterateOccurrences(event)) {
      if (isCancelled(occurrence.component)) {
        continue;
      }

      const startDate = occurrence.start.toJSDate();
      const endDate = occurrence.end.toJSDate();

      if (!(startDate instanceof Date) || Number.isNaN(startDate.valueOf())) {
        continue;
      }
      if (!(endDate instanceof Date) || Number.isNaN(endDate.valueOf())) {
        continue;
      }
      if (endDate <= startDate) {
        continue;
      }

      const interval = {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        allDay: occurrence.start.isDate && occurrence.end.isDate,
      };
      intervals.push(interval);

      for (const busyDate of expandBusyDates(occurrence.start, occurrence.end)) {
        busyDates.add(busyDate);
      }
    }
  }

  intervals.sort((a, b) => a.start.localeCompare(b.start));
  const days = Array.from(busyDates);
  days.sort();

  return { intervals, busyDates: days };
}

function normaliseInterval(entry) {
  return {
    start: typeof entry?.start === 'string' ? entry.start : String(entry?.start ?? ''),
    end: typeof entry?.end === 'string' ? entry.end : String(entry?.end ?? ''),
    allDay: Boolean(entry?.allDay),
  };
}

function intervalsEqual(previous, next) {
  if (previous.length !== next.length) {
    return false;
  }
  for (let index = 0; index < previous.length; index += 1) {
    const prev = normaliseInterval(previous[index]);
    const curr = normaliseInterval(next[index]);
    if (prev.start !== curr.start || prev.end !== curr.end || prev.allDay !== curr.allDay) {
      return false;
    }
  }
  return true;
}

function busyDatesEqual(previous, next) {
  if (previous.length !== next.length) {
    return false;
  }
  for (let index = 0; index < previous.length; index += 1) {
    if (String(previous[index]) !== String(next[index])) {
      return false;
    }
  }
  return true;
}

async function writeBusyFile(name, data) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, `busy-${name}.json`);
  const nextContent = {
    intervals: data.intervals,
    busyDates: data.busyDates,
  };

  try {
    const existingRaw = await fs.readFile(filePath, 'utf8');
    const existing = JSON.parse(existingRaw);
    const previousContent = {
      intervals: Array.isArray(existing.intervals) ? existing.intervals : [],
      busyDates: Array.isArray(existing.busyDates) ? existing.busyDates : [],
    };

    if (
      intervalsEqual(previousContent.intervals, nextContent.intervals) &&
      busyDatesEqual(previousContent.busyDates, nextContent.busyDates)
    ) {
      return { filePath, updated: false };
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    ...nextContent,
  };
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { filePath, updated: true };
}

async function main() {
  const calendars = getCalendarsFromEnv();
  let hadError = false;

  for (const calendar of calendars) {
    try {
      console.log(`Оновлення календаря ${calendar.name}...`);
      const icsText = await readCalendarSource(calendar.source);
      const data = extractBusyData(icsText);
      const result = await writeBusyFile(calendar.name, data);
      if (result.updated) {
        console.log(`  ✓ Оновлено: data/busy-${calendar.name}.json`);
      } else {
        console.log(`  • Без змін: data/busy-${calendar.name}.json`);
      }
    } catch (error) {
      hadError = true;
      console.error(`  ✗ Не вдалося оновити календар ${calendar.name}: ${error.message}`);
    }
  }

  if (hadError) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Помилка виконання: ${error.message}`);
  process.exitCode = 1;
});
