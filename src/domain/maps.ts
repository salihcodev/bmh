import { normalizeDigits } from '@/utils/arabic';

export type Coords = { lat: number; lng: number };
export type ParseResult = { ok: true; coords: Coords } | { ok: false; reason: 'invalid' | 'shortLink' };

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)';
const PAIR = new RegExp(`${NUM}\\s*,\\s*${NUM}`);

export function validCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/** First pin the map may use (V8-D3). Skips missing, NaN, out of range, and 0/0. */
export function firstValidPin(pins: readonly { lat: number; lng: number }[] | undefined | null): Coords | null {
  for (const pin of pins ?? []) {
    if (validCoords(pin.lat, pin.lng)) return { lat: pin.lat, lng: pin.lng };
  }
  return null;
}

/** GeoJSON / OSRM order. App data stays lat,lng. */
export function toLngLat({ lat, lng }: Coords): [number, number] {
  return [lng, lat];
}

export function directionsUrl(origin: Coords, dest: Coords): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${round(origin.lat)},${round(origin.lng)}&destination=${round(dest.lat)},${round(dest.lng)}`;
}

function pair(value: string | undefined | null): Coords | null {
  if (!value) return null;
  const match = PAIR.exec(value);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return validCoords(lat, lng) ? { lat, lng } : null;
}

const SHORT_HOSTS = /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i;

/**
 * Reads coordinates from "lat, lng" text (Arabic digits/comma allowed) or a Google
 * Maps URL. Short links hide the coordinates and need a network redirect first.
 */
export function parseCoordinates(input: string): ParseResult {
  const value = normalizeDigits(input).replace(/،/g, ',').trim();
  if (!value) return { ok: false, reason: 'invalid' };

  if (!/^https?:|^geo:/i.test(value)) {
    const coords = pair(value);
    return coords ? { ok: true, coords } : { ok: false, reason: 'invalid' };
  }

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // keep raw
  }

  // Exact place pin: !3d<lat>!4d<lng> (preferred over the viewport centre).
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(decoded);
  if (pin) {
    const lat = Number(pin[1]);
    const lng = Number(pin[2]);
    if (validCoords(lat, lng)) return { ok: true, coords: { lat, lng } };
  }

  if (/^geo:/i.test(decoded)) {
    const coords = pair(decoded.slice(4));
    if (coords) return { ok: true, coords };
  }

  for (const key of ['q', 'query', 'll', 'destination', 'center', 'daddr']) {
    const match = new RegExp(`[?&]${key}=([^&]+)`).exec(decoded);
    const coords = pair(match?.[1]?.replace(/\+/g, ' '));
    if (coords) return { ok: true, coords };
  }

  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(decoded);
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (validCoords(lat, lng)) return { ok: true, coords: { lat, lng } };
  }

  const path = /\/maps\/(?:search|dir|place)\/(?:[^/]*\/)?(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/.exec(
    decoded.replace(/\+/g, ' '),
  );
  if (path) {
    const lat = Number(path[1]);
    const lng = Number(path[2]);
    if (validCoords(lat, lng)) return { ok: true, coords: { lat, lng } };
  }

  if (SHORT_HOSTS.test(decoded)) return { ok: false, reason: 'shortLink' };
  return { ok: false, reason: 'invalid' };
}

export function isShortMapsLink(input: string): boolean {
  return SHORT_HOSTS.test(input);
}

export function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Universal Google Maps link: opens the app on Android/iOS when installed, the browser otherwise. */
export function mapsUrl({ lat, lng }: Coords): string {
  return `https://www.google.com/maps/search/?api=1&query=${round(lat)},${round(lng)}`;
}

export function formatCoords({ lat, lng }: Coords): string {
  return `${round(lat)}, ${round(lng)}`;
}
