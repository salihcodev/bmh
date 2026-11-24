import { isPlaceholder, type Localized } from './marketing';

// Support methods (CONT-04/05): the ways to support the charity that the Support screen lists
// (InstaPay, Vodafone Cash, ...), edited in the dashboard. Pure module: normalizer, what the app
// may show, the form draft, and reordering.

export type SupportMethod = {
  id: string;
  title: Localized;
  description: Localized;
  imagePublicId: string | null;
  /** The text a donor copies (an InstaPay address, a wallet number). */
  copyValue: string | null;
  copyLabel: Localized | null;
  /** An https page or payment link to open. */
  linkUrl: string | null;
  order: number;
  isActive: boolean;
  isDeleted: boolean;
};

function text(value: unknown): Localized {
  const v = (value ?? {}) as { ar?: unknown; en?: unknown };
  return { ar: typeof v.ar === 'string' ? v.ar : '', en: typeof v.en === 'string' ? v.en : '' };
}

function optionalText(value: unknown): Localized | null {
  const t = text(value);
  return t.ar || t.en ? t : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** An https link, or null. Seed placeholders and other schemes count as missing. */
export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value || isPlaceholder(value)) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeSupportMethod(id: string, data: unknown): SupportMethod {
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    id,
    title: text(d.title),
    description: text(d.description),
    imagePublicId: optionalString(d.imagePublicId),
    copyValue: isPlaceholder(optionalString(d.copyValue)) ? null : optionalString(d.copyValue),
    copyLabel: optionalText(d.copyLabel),
    linkUrl: safeHttpsUrl(optionalString(d.linkUrl)),
    order: typeof d.order === 'number' ? d.order : 0,
    isActive: d.isActive === true,
    isDeleted: d.isDeleted === true,
  };
}

/** What the Support screen lists: active, not deleted, titled, and something to do (copy or open). */
export function visibleSupportMethods(methods: SupportMethod[]): SupportMethod[] {
  return methods
    .filter((m) => m.isActive && !m.isDeleted && (m.title.ar || m.title.en) && (m.copyValue || m.linkUrl))
    .sort((a, b) => a.order - b.order);
}

// ---------- dashboard form ----------

export const SUPPORT_TITLE_MAX = 80;
export const SUPPORT_DESCRIPTION_MAX = 500;
export const SUPPORT_COPY_VALUE_MAX = 300;
export const SUPPORT_COPY_LABEL_MAX = 60;
export const SUPPORT_LINK_MAX = 500;
export const SUPPORT_ORDER_MAX = 999;

export type SupportMethodDraft = {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  imagePublicId: string | null;
  copyValue: string;
  copyLabelAr: string;
  copyLabelEn: string;
  linkUrl: string;
  /** Used when creating. An existing method is shown or hidden from the list. */
  isActive: boolean;
};

export type SupportMethodPayload = {
  title: Localized;
  description: Localized;
  imagePublicId: string | null;
  copyValue: string | null;
  copyLabel: Localized | null;
  linkUrl: string | null;
};

export type SupportMethodErrors = Partial<Record<keyof SupportMethodDraft, 'required' | 'bothLanguages' | 'invalidLink' | 'nothingToDo'>>;

export function emptySupportDraft(): SupportMethodDraft {
  return {
    titleAr: '',
    titleEn: '',
    descriptionAr: '',
    descriptionEn: '',
    imagePublicId: null,
    copyValue: '',
    copyLabelAr: '',
    copyLabelEn: '',
    linkUrl: '',
    isActive: false,
  };
}

export function draftFromSupportMethod(method: SupportMethod): SupportMethodDraft {
  return {
    titleAr: method.title.ar,
    titleEn: method.title.en,
    descriptionAr: method.description.ar,
    descriptionEn: method.description.en,
    imagePublicId: method.imagePublicId,
    copyValue: method.copyValue ?? '',
    copyLabelAr: method.copyLabel?.ar ?? '',
    copyLabelEn: method.copyLabel?.en ?? '',
    linkUrl: method.linkUrl ?? '',
    isActive: method.isActive,
  };
}

/** Matches the rules: bilingual title, https link only, copy label in both languages or neither. */
export function validateSupportDraft(
  draft: SupportMethodDraft,
): { ok: true; value: SupportMethodPayload } | { ok: false; errors: SupportMethodErrors } {
  const errors: SupportMethodErrors = {};
  const cut = (value: string, max: number) => value.trim().slice(0, max);
  if (!draft.titleAr.trim()) errors.titleAr = 'required';
  if (!draft.titleEn.trim()) errors.titleEn = 'required';
  const copyValue = draft.copyValue.trim();
  const link = draft.linkUrl.trim();
  if (link && (!safeHttpsUrl(link) || link.length > SUPPORT_LINK_MAX)) errors.linkUrl = 'invalidLink';
  if (!copyValue && !link && !errors.linkUrl) errors.copyValue = 'nothingToDo';
  const labelAr = draft.copyLabelAr.trim();
  const labelEn = draft.copyLabelEn.trim();
  if ((labelAr === '') !== (labelEn === '')) errors[labelAr ? 'copyLabelEn' : 'copyLabelAr'] = 'bothLanguages';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title: { ar: cut(draft.titleAr, SUPPORT_TITLE_MAX), en: cut(draft.titleEn, SUPPORT_TITLE_MAX) },
      description: { ar: cut(draft.descriptionAr, SUPPORT_DESCRIPTION_MAX), en: cut(draft.descriptionEn, SUPPORT_DESCRIPTION_MAX) },
      imagePublicId: draft.imagePublicId,
      copyValue: copyValue ? copyValue.slice(0, SUPPORT_COPY_VALUE_MAX) : null,
      copyLabel: labelAr ? { ar: cut(labelAr, SUPPORT_COPY_LABEL_MAX), en: cut(labelEn, SUPPORT_COPY_LABEL_MAX) } : null,
      linkUrl: link ? safeHttpsUrl(link) : null,
    },
  };
}

// ---------- ordering ----------

/** The next `order` for a new method: after the last one, within the rules' 0..999 range. */
export function nextSupportOrder(methods: readonly Pick<SupportMethod, 'order'>[]): number {
  return Math.min(SUPPORT_ORDER_MAX, methods.reduce((max, m) => Math.max(max, m.order + 1), 0));
}

/**
 * Moving a method one step up or down swaps it with its neighbour. Returns the `order` writes that
 * are needed (two documents, so a batch stays small), or an empty list at either end of the list.
 * Orders are renumbered 0..n-1 when two methods share a value, so a swap always changes something.
 */
export function swapOrders(
  sorted: readonly Pick<SupportMethod, 'id' | 'order'>[],
  id: string,
  direction: 'up' | 'down',
): { id: string; order: number }[] {
  const index = sorted.findIndex((m) => m.id === id);
  const other = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || other < 0 || other >= sorted.length) return [];
  const a = sorted[index]!;
  const b = sorted[other]!;
  if (a.order !== b.order) return [{ id: a.id, order: b.order }, { id: b.id, order: a.order }];
  // Equal orders: place the moved item on the side it was sent to.
  const base = Math.min(a.order, SUPPORT_ORDER_MAX - 1);
  return direction === 'up'
    ? [{ id: a.id, order: base }, { id: b.id, order: base + 1 }]
    : [{ id: b.id, order: base }, { id: a.id, order: base + 1 }];
}
