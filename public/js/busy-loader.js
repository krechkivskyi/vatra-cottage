/**
 * Loads sanitized busy intervals for a given calendar.
 * @param {string} name Identifier used in the JSON filename (e.g. "cottage1").
 * @returns {Promise<{start: string, end: string}[]>}
 */
export async function loadBusy(name) {
  if (!name) {
    throw new Error('Calendar name is required');
  }

  const response = await fetch(`/data/busy-${encodeURIComponent(name)}.json`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to load busy data for ${name}`);
  }

  const payload = await response.json();

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid busy calendar payload');
  }

  if (!payload.updatedAt || !Array.isArray(payload.events)) {
    throw new Error('Busy calendar payload missing required fields');
  }

  return payload.events.map((event) => {
    if (!event || typeof event.start !== 'string' || typeof event.end !== 'string') {
      throw new Error('Busy calendar event is malformed');
    }
    return { start: event.start, end: event.end };
  });
}
