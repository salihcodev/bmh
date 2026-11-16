import { describe, expect, it } from 'vitest';

import { formatCoords, mapsUrl, parseCoordinates } from '@/domain/maps';

const C = { lat: 30.0444, lng: 31.2357 };

describe('parseCoordinates', () => {
  it('reads plain "lat, lng" in Western or Arabic digits', () => {
    expect(parseCoordinates('30.0444, 31.2357')).toEqual({ ok: true, coords: C });
    expect(parseCoordinates('30.0444,31.2357')).toEqual({ ok: true, coords: C });
    expect(parseCoordinates('٣٠٫٠٤٤٤، ٣١٫٢٣٥٧')).toEqual({ ok: true, coords: C });
  });

  it('reads common Google Maps URL shapes', () => {
    const urls = [
      'https://www.google.com/maps/@30.0444,31.2357,15z',
      'https://www.google.com/maps?q=30.0444,31.2357',
      'https://maps.google.com/?ll=30.0444,31.2357&z=14',
      'https://www.google.com/maps/search/?api=1&query=30.0444%2C31.2357',
      'https://www.google.com/maps/place/Cairo/@29.9,31.1,12z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d30.0444!4d31.2357',
      'https://www.google.com/maps/dir/?api=1&destination=30.0444,31.2357',
      'https://www.google.com/maps/search/30.0444,+31.2357',
      'geo:30.0444,31.2357?z=17',
    ];
    for (const url of urls) expect(parseCoordinates(url), url).toEqual({ ok: true, coords: C });
  });

  it('prefers the exact place pin over the viewport centre', () => {
    const url = 'https://www.google.com/maps/place/X/@1.5,2.5,10z/data=!3d30.0444!4d31.2357';
    expect(parseCoordinates(url)).toEqual({ ok: true, coords: C });
  });

  it('flags short links and rejects invalid input', () => {
    expect(parseCoordinates('https://maps.app.goo.gl/AbCdEf')).toEqual({ ok: false, reason: 'shortLink' });
    expect(parseCoordinates('hello')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseCoordinates('95, 31')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseCoordinates('0, 0')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseCoordinates('https://example.com')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('builds a universal maps URL', () => {
    expect(mapsUrl(C)).toBe('https://www.google.com/maps/search/?api=1&query=30.0444,31.2357');
    expect(formatCoords({ lat: 30.04441234, lng: 31.23571234 })).toBe('30.044412, 31.235712');
  });
});
