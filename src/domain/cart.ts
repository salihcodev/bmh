import type { Bilingual } from './store';

/** One line in the device cart (MMKV, per user). */
export type CartLine = {
  storeItemId: string;
  supplierId: string;
  supplierName: string;
  name: Bilingual;
  imagePublicId: string | null;
  unitPriceMinor: number;
  quantity: number;
};

export type CartState = {
  lines: CartLine[];
  updatedAt: number;
};

export type CartTotals = {
  itemCount: number;
  lineCount: number;
  grandTotalMinor: number;
  currency: 'EGP';
  bySupplier: { supplierId: string; supplierName: string; totalMinor: number; itemCount: number }[];
};

export function emptyCart(): CartState {
  return { lines: [], updatedAt: Date.now() };
}

export function lineTotalMinor(line: CartLine): number {
  return line.unitPriceMinor * line.quantity;
}

export function cartTotals(lines: CartLine[]): CartTotals {
  const bySupplierMap = new Map<string, { supplierId: string; supplierName: string; totalMinor: number; itemCount: number }>();
  let grand = 0;
  let itemCount = 0;
  for (const line of lines) {
    const total = lineTotalMinor(line);
    grand += total;
    itemCount += line.quantity;
    const existing = bySupplierMap.get(line.supplierId);
    if (existing) {
      existing.totalMinor += total;
      existing.itemCount += line.quantity;
    } else {
      bySupplierMap.set(line.supplierId, {
        supplierId: line.supplierId,
        supplierName: line.supplierName,
        totalMinor: total,
        itemCount: line.quantity,
      });
    }
  }
  return {
    itemCount,
    lineCount: lines.length,
    grandTotalMinor: grand,
    currency: 'EGP',
    bySupplier: [...bySupplierMap.values()],
  };
}

export function setQuantity(lines: CartLine[], storeItemId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.storeItemId !== storeItemId);
  const next = Math.min(999, Math.floor(quantity));
  return lines.map((l) => (l.storeItemId === storeItemId ? { ...l, quantity: next } : l));
}

export function addOrBump(
  lines: CartLine[],
  input: Omit<CartLine, 'quantity'> & { quantity?: number },
): CartLine[] {
  const qty = Math.max(1, Math.min(999, Math.floor(input.quantity ?? 1)));
  const idx = lines.findIndex((l) => l.storeItemId === input.storeItemId);
  if (idx >= 0) {
    const copy = [...lines];
    const current = copy[idx]!;
    copy[idx] = { ...current, quantity: Math.min(999, current.quantity + qty) };
    return copy;
  }
  return [
    ...lines,
    {
      storeItemId: input.storeItemId,
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      name: input.name,
      imagePublicId: input.imagePublicId,
      unitPriceMinor: input.unitPriceMinor,
      quantity: qty,
    },
  ];
}

export function removeLine(lines: CartLine[], storeItemId: string): CartLine[] {
  return lines.filter((l) => l.storeItemId !== storeItemId);
}

export function parseCart(raw: unknown): CartState {
  if (!raw || typeof raw !== 'object') return emptyCart();
  const data = raw as Record<string, unknown>;
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const parsed: CartLine[] = [];
  for (const entry of lines) {
    if (!entry || typeof entry !== 'object') continue;
    const l = entry as Record<string, unknown>;
    if (typeof l.storeItemId !== 'string' || typeof l.supplierId !== 'string') continue;
    const name =
      l.name && typeof l.name === 'object'
        ? {
            ar: typeof (l.name as { ar?: unknown }).ar === 'string' ? (l.name as { ar: string }).ar : '',
            en: typeof (l.name as { en?: unknown }).en === 'string' ? (l.name as { en: string }).en : '',
          }
        : { ar: '', en: '' };
    parsed.push({
      storeItemId: l.storeItemId,
      supplierId: l.supplierId,
      supplierName: typeof l.supplierName === 'string' ? l.supplierName : '',
      name,
      imagePublicId: typeof l.imagePublicId === 'string' ? l.imagePublicId : null,
      unitPriceMinor: typeof l.unitPriceMinor === 'number' ? Math.max(0, Math.floor(l.unitPriceMinor)) : 0,
      quantity: typeof l.quantity === 'number' ? Math.max(1, Math.min(999, Math.floor(l.quantity))) : 1,
    });
  }
  return {
    lines: parsed,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
  };
}
