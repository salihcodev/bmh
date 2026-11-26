import { afterEach, describe, expect, it, vi } from 'vitest';

import { firstValidPin, toLngLat, validCoords } from '@/domain/maps';
import { sessionMapPoints } from '@/features/map/session-points';
import {
  clearRouteCache,
  createOsrmProvider,
  straightLineFallback,
} from '@/features/map/services/routing.service';
import { visitFromStatus } from '@/features/map/types/map.types';
import { routeCacheKey } from '@/features/map/utils/coordinates';

vi.mock('@/services/sync/connectivity', () => ({
  isOnlineNow: () => true,
}));

const origin = { lat: 30.0444, lng: 31.2357 };
const dest = { lat: 30.05, lng: 31.25 };

afterEach(() => {
  clearRouteCache();
});

describe('coordinates', () => {
  it('picks the first valid pin and skips 0/0', () => {
    expect(firstValidPin([{ lat: 0, lng: 0 }, { lat: 30.1, lng: 31.2 }])).toEqual({ lat: 30.1, lng: 31.2 });
    expect(firstValidPin([{ lat: 95, lng: 1 }])).toBeNull();
    expect(toLngLat(origin)).toEqual([31.2357, 30.0444]);
    expect(validCoords(Number.NaN, 31)).toBe(false);
  });

  it('rounds cache keys so nearby GPS jitter matches', () => {
    const a = routeCacheKey({ lat: 30.04441, lng: 31.23571 }, dest);
    const b = routeCacheKey({ lat: 30.04444, lng: 31.23572 }, dest);
    expect(a).toBe(b);
  });
});

describe('OSRM provider', () => {
  it('reads geometry, metres and seconds from routes[0]', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [
            {
              distance: 1234,
              duration: 300,
              geometry: { type: 'LineString', coordinates: [[31.23, 30.04], [31.25, 30.05]] },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = createOsrmProvider(fetchImpl as unknown as typeof fetch);
    const route = await provider.getRoute(origin, dest, new AbortController().signal);
    expect(route).toMatchObject({ kind: 'osrm', distanceM: 1234, durationS: 300 });
    expect(route.geometry?.coordinates).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('reuses the cache within the TTL', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [{ distance: 10, duration: 20, geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] } }],
        }),
        { status: 200 },
      ),
    );
    const provider = createOsrmProvider(fetchImpl as unknown as typeof fetch, () => 1_000);
    await provider.getRoute(origin, dest, new AbortController().signal);
    await provider.getRoute(origin, dest, new AbortController().signal);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('falls back on 429, no-route and network errors', async () => {
    const rateLimited = createOsrmProvider(
      vi.fn(async () => new Response('', { status: 429 })) as unknown as typeof fetch,
    );
    const r429 = await rateLimited.getRoute(origin, dest, new AbortController().signal);
    expect(r429.kind).toBe('fallback');
    expect(r429.reason).toBe('rateLimit');

    const empty = createOsrmProvider(
      vi.fn(async () => new Response(JSON.stringify({ code: 'Ok', routes: [] }), { status: 200 })) as unknown as typeof fetch,
    );
    const none = await empty.getRoute(origin, dest, new AbortController().signal);
    expect(none.reason).toBe('noRoute');

    const boom = createOsrmProvider(
      vi.fn(async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch,
    );
    const net = await boom.getRoute(origin, dest, new AbortController().signal);
    expect(net.reason).toBe('network');
    expect(net.distanceM).toBeGreaterThan(0);
  });

  it('ignores a stale in-flight request when aborted', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    });
    const provider = createOsrmProvider(fetchImpl as unknown as typeof fetch);
    const pending = provider.getRoute(origin, dest, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeTruthy();
  });
});

describe('session map points', () => {
  it('marks visited vs remaining and drops invalid pins', () => {
    expect(visitFromStatus('checked')).toBe('visited');
    expect(visitFromStatus('pending')).toBe('remaining');
    const { points, missingCount } = sessionMapPoints([
      {
        id: '1',
        beneficiaryId: 'b1',
        order: 0,
        fullName: 'A',
        householdCount: 1,
        primaryPhone: null,
        phones: [],
        areaId: 'a',
        areaName: 'A',
        mapPins: [{ id: 'p', lat: 30, lng: 31, createdAt: {} as never, updatedAt: {} as never, createdBy: 'u' }],
        status: 'checked',
        processedAt: null,
        processedBy: null,
      },
      {
        id: '2',
        beneficiaryId: 'b2',
        order: 1,
        fullName: 'B',
        householdCount: 1,
        primaryPhone: null,
        phones: [],
        areaId: 'a',
        areaName: 'A',
        mapPins: [{ id: 'p', lat: 0, lng: 0, createdAt: {} as never, updatedAt: {} as never, createdBy: 'u' }],
        status: 'pending',
        processedAt: null,
        processedBy: null,
      },
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]?.visit).toBe('visited');
    expect(missingCount).toBe(1);
  });
});

describe('straight-line fallback', () => {
  it('returns a line between origin and destination', () => {
    const route = straightLineFallback(origin, dest, 'timeout');
    expect(route.kind).toBe('fallback');
    expect(route.geometry?.coordinates[0]).toEqual(toLngLat(origin));
  });
});
