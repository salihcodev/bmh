import { create } from 'zustand';

import {
  addOrBump,
  cartTotals,
  emptyCart,
  parseCart,
  removeLine,
  setQuantity,
  type CartLine,
  type CartState,
  type CartTotals,
} from '@/domain/cart';
import { appStorage as mmkv } from '@/services/storage/mmkv';
import { userKey } from '@/services/storage/user-scope';

type CartStore = {
  uid: string | null;
  cart: CartState;
  totals: CartTotals;
  hydrate: (uid: string | null) => void;
  add: (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => void;
  setQty: (storeItemId: string, quantity: number) => void;
  remove: (storeItemId: string) => void;
  clear: () => void;
  replaceFromBag: (lines: CartLine[]) => void;
};

function persist(uid: string, cart: CartState) {
  mmkv.set(userKey(uid, 'cart.v1'), JSON.stringify(cart));
}

function load(uid: string): CartState {
  const raw = mmkv.getString(userKey(uid, 'cart.v1'));
  if (!raw) return emptyCart();
  try {
    return parseCart(JSON.parse(raw));
  } catch {
    return emptyCart();
  }
}

function withTotals(cart: CartState): Pick<CartStore, 'cart' | 'totals'> {
  return { cart, totals: cartTotals(cart.lines) };
}

export const useCartStore = create<CartStore>((set, get) => ({
  uid: null,
  cart: emptyCart(),
  totals: cartTotals([]),
  hydrate: (uid) => {
    if (!uid) {
      set({ uid: null, ...withTotals(emptyCart()) });
      return;
    }
    set({ uid, ...withTotals(load(uid)) });
  },
  add: (line) => {
    const { uid, cart } = get();
    if (!uid) return;
    const next = { lines: addOrBump(cart.lines, line), updatedAt: Date.now() };
    persist(uid, next);
    set({ ...withTotals(next) });
  },
  setQty: (storeItemId, quantity) => {
    const { uid, cart } = get();
    if (!uid) return;
    const next = { lines: setQuantity(cart.lines, storeItemId, quantity), updatedAt: Date.now() };
    persist(uid, next);
    set({ ...withTotals(next) });
  },
  remove: (storeItemId) => {
    const { uid, cart } = get();
    if (!uid) return;
    const next = { lines: removeLine(cart.lines, storeItemId), updatedAt: Date.now() };
    persist(uid, next);
    set({ ...withTotals(next) });
  },
  clear: () => {
    const { uid } = get();
    if (!uid) return;
    const next = emptyCart();
    persist(uid, next);
    set({ ...withTotals(next) });
  },
  replaceFromBag: (lines) => {
    const { uid } = get();
    if (!uid) return;
    const next = { lines, updatedAt: Date.now() };
    persist(uid, next);
    set({ ...withTotals(next) });
  },
}));
