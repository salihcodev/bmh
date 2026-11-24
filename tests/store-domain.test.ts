import { describe, expect, it } from 'vitest';

import {
  bagLink,
  bagTotalsFromItems,
  diffBagItems,
  parseBagToken,
  unseenChangeCount,
  type BagItem,
} from '@/domain/bag';
import {
  addOrBump,
  cartTotals,
  parseCart,
  removeLine,
  setQuantity,
  type CartLine,
} from '@/domain/cart';
import {
  canReviewSupplier,
  clampRating,
  hideDelta,
  ratingDelta,
} from '@/domain/review';
import {
  filterStoreItems,
  formatPriceMinor,
  majorToMinor,
  normalizeStoreConfig,
} from '@/domain/store';
import { supplierRating } from '@/domain/supplier-profile';

const line = (overrides: Partial<CartLine> = {}): CartLine => ({
  storeItemId: 'i1',
  supplierId: 's1',
  supplierName: 'Supplier',
  name: { ar: 'أرز', en: 'Rice' },
  imagePublicId: null,
  unitPriceMinor: 1000,
  quantity: 2,
  ...overrides,
});

describe('cart', () => {
  it('adds, bumps, sets quantity and clears a line', () => {
    let lines = addOrBump([], line({ quantity: 1 }));
    expect(lines).toHaveLength(1);
    lines = addOrBump(lines, line({ quantity: 2 }));
    expect(lines[0]?.quantity).toBe(3);
    lines = setQuantity(lines, 'i1', 5);
    expect(lines[0]?.quantity).toBe(5);
    lines = setQuantity(lines, 'i1', 0);
    expect(lines).toHaveLength(0);
    lines = addOrBump([], line());
    lines = removeLine(lines, 'i1');
    expect(lines).toHaveLength(0);
  });

  it('totals by supplier and grand total', () => {
    const totals = cartTotals([
      line({
        storeItemId: 'a',
        supplierId: 's1',
        quantity: 2,
        unitPriceMinor: 1000,
      }),
      line({
        storeItemId: 'b',
        supplierId: 's2',
        supplierName: 'Other',
        quantity: 1,
        unitPriceMinor: 500,
      }),
      line({
        storeItemId: 'c',
        supplierId: 's1',
        quantity: 1,
        unitPriceMinor: 250,
      }),
    ]);
    expect(totals.itemCount).toBe(4);
    expect(totals.grandTotalMinor).toBe(2750);
    expect(totals.bySupplier).toHaveLength(2);
    expect(
      totals.bySupplier.find((s) => s.supplierId === 's1')?.totalMinor,
    ).toBe(2250);
  });

  it('parses persisted cart JSON and drops junk', () => {
    const parsed = parseCart({
      lines: [line(), { storeItemId: 1 }, null],
      updatedAt: 10,
    });
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.updatedAt).toBe(10);
  });
});

describe('store helpers', () => {
  it('formats EGP and converts major/minor', () => {
    expect(majorToMinor(12.5)).toBe(1250);
    expect(formatPriceMinor(1250, 'EGP', 'en')).toContain('12.50');
    expect(formatPriceMinor(1250, 'EGP', 'ar')).toContain('12.50');
  });

  it('filters the current page by price and availability', () => {
    const items = [
      {
        id: '1',
        priceMinor: 100,
        isAvailable: true,
        supplierId: 'a',
        status: 'active',
        isDeleted: false,
      },
      {
        id: '2',
        priceMinor: 500,
        isAvailable: false,
        supplierId: 'b',
        status: 'active',
        isDeleted: false,
      },
      {
        id: '3',
        priceMinor: 300,
        isAvailable: true,
        supplierId: 'a',
        status: 'active',
        isDeleted: false,
      },
    ] as never;
    expect(
      filterStoreItems(items, { minPriceMinor: 200, availableOnly: true }),
    ).toHaveLength(1);
  });

  it('normalizes store config with defaults and clamps', () => {
    expect(normalizeStoreConfig(null).popularItemsCount).toBe(8);
    expect(
      normalizeStoreConfig({ popularItemsCount: 99 }).popularItemsCount,
    ).toBe(12);
    expect(normalizeStoreConfig({ topBagsCount: 0 }).topBagsCount).toBe(1);
  });
});

describe('reviews', () => {
  it('blocks self-review and clamps ratings', () => {
    expect(canReviewSupplier('a', 'a')).toBe(false);
    expect(canReviewSupplier('a', 'b')).toBe(true);
    expect(clampRating(9)).toBe(5);
    expect(ratingDelta(null, 4)).toEqual({ sum: 4, count: 1 });
    expect(ratingDelta(3, 5)).toEqual({ sum: 2, count: 0 });
    expect(hideDelta(4, true)).toEqual({ sum: -4, count: -1 });
  });

  it('averages supplier ratings', () => {
    expect(supplierRating({ ratingSum: 9, ratingCount: 2 })).toBe(4.5);
    expect(supplierRating({ ratingSum: 0, ratingCount: 0 })).toBeNull();
  });
});

describe('bags', () => {
  const item = (id: string, qty: number, price = 100): BagItem => ({
    id,
    storeItemId: id,
    supplierId: 's1',
    supplierName: 'S',
    name: { ar: id, en: id },
    imagePublicId: null,
    unitPriceMinor: price,
    quantity: qty,
    addedBy: 'u',
  });

  it('parses bag links and builds share URLs', () => {
    const token = 'ABCDEFGHJKLMNPQRSTUVWXYZabcd';
    expect(parseBagToken(`https://bmyhand.vercel.app/bag/${token}`)).toBe(
      token,
    );
    expect(parseBagToken(`bemyhand://bag/${token}`)).toBe(token);
    expect(parseBagToken(token)).toBe(token);
    expect(parseBagToken('short')).toBeNull();
    expect(bagLink(token)).toContain(`/bag/${token}`);
  });

  it('diffs items and counts unseen changes', () => {
    const original = [item('a', 2), item('b', 1)];
    const current = [item('a', 5), item('c', 1)];
    const diffs = diffBagItems(original, current);
    expect(diffs.map((d) => d.type).sort()).toEqual([
      'item-added',
      'item-removed',
      'quantity',
    ]);
    expect(
      unseenChangeCount(
        [
          { version: 1 } as never,
          { version: 3 } as never,
          { version: 4 } as never,
        ],
        2,
      ),
    ).toBe(2);
  });

  it('totals bag items', () => {
    const totals = bagTotalsFromItems([item('a', 2, 100), item('b', 1, 50)]);
    expect(totals.totalMinor).toBe(250);
    expect(totals.itemsCount).toBe(2);
  });
});
