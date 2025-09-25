#!/usr/bin/env python3
"""Fetches Booking.com iCal feeds and writes sanitized availability JSON."""

from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.request import Request, urlopen

DATA_PATH = Path('data/calendar-availability.json')
ISO_DATE = '%Y-%m-%d'

COTTAGE_SOURCES: Dict[str, str] = {
    '1': os.environ.get('BOOKING_CALENDAR_1', ''),
    '2': os.environ.get('BOOKING_CALENDAR_2', ''),
}


def _validate_sources(sources: Dict[str, str]) -> Dict[str, str]:
    missing = [cid for cid, url in sources.items() if not url]
    if missing:
        sys.stderr.write(
            'Відсутні обов\'язкові секрети для календарів: ' + ', '.join(sorted(missing)) + '\n'
        )
        sys.exit(1)
    return sources


def _unfold_ics_lines(text: str) -> Iterable[str]:
    """Unfolds ICS lines according to RFC 5545."""
    prev = None
    for raw_line in text.splitlines():
        if raw_line.startswith((' ', '\t')) and prev is not None:
            prev += raw_line[1:]
        else:
            if prev is not None:
                yield prev
            prev = raw_line
    if prev is not None:
        yield prev


def _parse_ics_datetime(value: str) -> datetime:
    value = value.strip()
    tz = None
    if value.endswith('Z'):
        value = value[:-1]
        tz = timezone.utc

    fmt: Optional[str]
    if len(value) == 8 and value.isdigit():
        fmt = '%Y%m%d'
    elif len(value) == 13 and value[8] == 'T':
        fmt = '%Y%m%dT%H%M'
    elif len(value) == 15 and value[8] == 'T':
        fmt = '%Y%m%dT%H%M%S'
    else:
        raise ValueError(f'Unsupported ICS datetime format: {value!r}')

    parsed = datetime.strptime(value, fmt)
    if fmt == '%Y%m%d':
        return datetime(parsed.year, parsed.month, parsed.day)
    if tz is not None:
        parsed = parsed.replace(tzinfo=tz)
    return parsed


def _to_date(value: datetime) -> date:
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc)
    return value.date()


def _parse_events(text: str) -> List[Tuple[date, date]]:
    events: List[Tuple[date, date]] = []
    in_event = False
    event_data: Dict[str, str] = {}

    for line in _unfold_ics_lines(text):
        if line == 'BEGIN:VEVENT':
            in_event = True
            event_data = {}
            continue
        if line == 'END:VEVENT':
            in_event = False
            start_raw = event_data.get('DTSTART')
            end_raw = event_data.get('DTEND')
            if not start_raw or not end_raw:
                continue
            try:
                start_dt = _parse_ics_datetime(start_raw)
                end_dt = _parse_ics_datetime(end_raw)
            except ValueError:
                continue
            start_date = _to_date(start_dt)
            end_date = _to_date(end_dt)
            if end_date <= start_date:
                continue
            events.append((start_date, end_date))
            continue
        if not in_event:
            continue
        if ':' not in line:
            continue
        key, value = line.split(':', 1)
        field = key.split(';', 1)[0].strip().upper()
        if field in {'DTSTART', 'DTEND'}:
            event_data[field] = value.strip()

    return events


def _merge_intervals(intervals: Iterable[Tuple[date, date]]) -> List[Tuple[date, date]]:
    sorted_intervals = sorted(intervals, key=lambda item: item[0])
    merged: List[Tuple[date, date]] = []
    for start, end in sorted_intervals:
        if not merged:
            merged.append((start, end))
            continue
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def _fetch_ics(url: str) -> str:
    request = Request(url, headers={'User-Agent': 'availability-sync/1.0'})
    with urlopen(request, timeout=30) as response:  # nosec B310
        charset = response.headers.get_content_charset() or 'utf-8'
        return response.read().decode(charset, errors='ignore')


def _collect_cottages(
    sources: Dict[str, str],
    existing: Optional[Dict[str, object]] = None,
) -> Dict[str, List[Dict[str, str]]]:
    cottages: Dict[str, List[Dict[str, str]]] = {}
    existing_cottages: Dict[str, object] = {}
    if isinstance(existing, dict):
        maybe_cottages = existing.get('cottages')
        if isinstance(maybe_cottages, dict):
            existing_cottages = maybe_cottages

    for cottage_id, url in sources.items():
        try:
            ics_text = _fetch_ics(url)
            intervals = _merge_intervals(_parse_events(ics_text))
        except Exception as exc:  # pylint: disable=broad-except
            sys.stderr.write(f'Не вдалося оновити календар {cottage_id}: {exc}\n')
            previous = existing_cottages.get(cottage_id)
            if isinstance(previous, list):
                cottages[cottage_id] = previous
            continue

        cottages[cottage_id] = [
            {
                'start': start.strftime(ISO_DATE),
                'end': end.strftime(ISO_DATE),
            }
            for start, end in intervals
        ]

    return cottages


def main() -> None:
    sources = _validate_sources(COTTAGE_SOURCES)
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    existing: Optional[Dict[str, object]] = None
    if DATA_PATH.exists():
        try:
            existing = json.loads(DATA_PATH.read_text(encoding='utf-8'))
        except json.JSONDecodeError:
            existing = None

    cottages = _collect_cottages(sources, existing)

    previous_cottages: Dict[str, object] = {}
    if isinstance(existing, dict):
        maybe_prev = existing.get('cottages')
        if isinstance(maybe_prev, dict):
            previous_cottages = maybe_prev

    if cottages == previous_cottages:
        print('Дані календарів не змінилися. Оновлення не потрібне.')
        return

    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'cottages': cottages,
    }

    new_content = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
    DATA_PATH.write_text(new_content + '\n', encoding='utf-8')
    print('Оновлено дані календарів.')


if __name__ == '__main__':
    main()
