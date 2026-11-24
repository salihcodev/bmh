import type { Language, Localized } from './marketing';

// System messages (CONT-01/02): admin-written texts the app shows in named places, with the app's
// own i18n string as the fallback when a key is missing, unpublished, expired or not meant for the
// reader. Pure module: normalizer, visibility rules, and the dashboard draft validation.

export const MESSAGE_CATEGORIES = ['message', 'alert', 'info-text'] as const;
export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];

export const MESSAGE_TYPES = ['info', 'success', 'warning', 'error'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const AUDIENCE_KINDS = ['all', 'userType', 'role'] as const;
export type AudienceKind = (typeof AUDIENCE_KINDS)[number];
export type Audience = { kind: AudienceKind; values: string[] };

export type SystemMessage = {
  /** Same as `key` (the document id), so lists can treat it like any other item. */
  id: string;
  key: string;
  category: MessageCategory;
  type: MessageType;
  title: Localized | null;
  text: Localized;
  placement: string;
  audience: Audience;
  startsAt: number | null;
  endsAt: number | null;
  isPublished: boolean;
  isDeleted: boolean;
  createdAt: number | null;
  updatedAt: number | null;
};

const ALL: Audience = { kind: 'all', values: [] };

function millis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const v = value as { toMillis?: () => number; seconds?: number };
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

function localized(value: unknown): Localized | null {
  const v = value as { ar?: unknown; en?: unknown } | null;
  if (!v || typeof v !== 'object') return null;
  const ar = typeof v.ar === 'string' ? v.ar : '';
  const en = typeof v.en === 'string' ? v.en : '';
  return ar || en ? { ar, en } : null;
}

function oneOf<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : fallback;
}

function audienceOf(value: unknown): Audience {
  const v = value as { kind?: unknown; values?: unknown } | null;
  if (!v || typeof v !== 'object') return ALL;
  const kind = oneOf(AUDIENCE_KINDS, v.kind, 'all');
  const values = Array.isArray(v.values) ? v.values.filter((x): x is string => typeof x === 'string') : [];
  // A targeted audience with nobody listed reaches nobody, so it is never silently widened to everyone.
  return { kind, values };
}

/** Normalizes systemMessages/{key}. Unknown values degrade to the safest reading. */
export function normalizeSystemMessage(key: string, data: unknown): SystemMessage {
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    id: key,
    key,
    category: oneOf(MESSAGE_CATEGORIES, d.category, 'message'),
    type: oneOf(MESSAGE_TYPES, d.type, 'info'),
    title: localized(d.title),
    text: localized(d.text) ?? { ar: '', en: '' },
    placement: typeof d.placement === 'string' ? d.placement : '',
    audience: audienceOf(d.audience),
    startsAt: millis(d.startsAt),
    endsAt: millis(d.endsAt),
    isPublished: d.isPublished === true,
    isDeleted: d.isDeleted === true,
    createdAt: millis(d.createdAt),
    updatedAt: millis(d.updatedAt),
  };
}

export type Reader = { userType: string | null; roleIds: readonly string[] };

export function inWindow(message: Pick<SystemMessage, 'startsAt' | 'endsAt'>, now: number): boolean {
  return (message.startsAt == null || message.startsAt <= now) && (message.endsAt == null || message.endsAt > now);
}

export function matchesAudience(audience: Audience, reader: Reader): boolean {
  if (audience.kind === 'all') return true;
  if (audience.kind === 'userType') return reader.userType != null && audience.values.includes(reader.userType);
  return reader.roleIds.some((id) => audience.values.includes(id));
}

/** Shown to this reader right now: published, not deleted, inside its window, and addressed to them. */
export function isVisible(message: SystemMessage, reader: Reader, now: number): boolean {
  return message.isPublished && !message.isDeleted && inWindow(message, now) && matchesAudience(message.audience, reader);
}

/** Admin text in the reader's language, or the app's own string when nothing usable is published. */
export function resolveMessageText(
  message: SystemMessage | null,
  reader: Reader,
  now: number,
  language: Language,
  fallback: string,
): string {
  if (!message || !isVisible(message, reader, now)) return fallback;
  const text = message.text[language] || message.text[language === 'ar' ? 'en' : 'ar'];
  return text || fallback;
}

export function resolveMessageTitle(message: SystemMessage | null, language: Language): string | null {
  if (!message?.title) return null;
  return message.title[language] || message.title[language === 'ar' ? 'en' : 'ar'] || null;
}

// ---------- dashboard form ----------

export const MESSAGE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,59}$/;
/** Keys that would collide with a dashboard route. */
export const RESERVED_MESSAGE_KEYS = ['new'] as const;
export const PLACEMENT_MAX = 60;
export const MESSAGE_TITLE_MAX = 120;
export const MESSAGE_TEXT_MAX = 1000;

export type SystemMessageDraft = {
  key: string;
  category: MessageCategory;
  type: MessageType;
  titleAr: string;
  titleEn: string;
  textAr: string;
  textEn: string;
  placement: string;
  audienceKind: AudienceKind;
  /** User types or role ids, depending on the kind. */
  audienceValues: string[];
  isPublished: boolean;
};

export function emptyMessageDraft(category: MessageCategory = 'message'): SystemMessageDraft {
  return {
    key: '',
    category,
    type: 'info',
    titleAr: '',
    titleEn: '',
    textAr: '',
    textEn: '',
    placement: '',
    audienceKind: 'all',
    audienceValues: [],
    isPublished: false,
  };
}

export function draftFromMessage(message: SystemMessage): SystemMessageDraft {
  return {
    key: message.key,
    category: message.category,
    type: message.type,
    titleAr: message.title?.ar ?? '',
    titleEn: message.title?.en ?? '',
    textAr: message.text.ar,
    textEn: message.text.en,
    placement: message.placement,
    audienceKind: message.audience.kind,
    audienceValues: message.audience.values,
    isPublished: message.isPublished,
  };
}

export type MessageDraftError = 'required' | 'invalidKey' | 'bothLanguages' | 'audienceEmpty';
export type MessageDraftErrors = Partial<Record<keyof SystemMessageDraft, MessageDraftError>>;

/** What the dashboard writes to systemMessages/{key} (timestamps and actor are added by the writer). */
export type SystemMessagePayload = {
  key: string;
  category: MessageCategory;
  type: MessageType;
  title: Localized | null;
  text: Localized;
  placement: string;
  audience: Audience;
  isPublished: boolean;
};

/** The rules need both languages (or none for the optional title), so the form asks for the same. */
export function validateMessageDraft(
  draft: SystemMessageDraft,
  options: { isNew: boolean },
): { ok: true; value: SystemMessagePayload } | { ok: false; errors: MessageDraftErrors } {
  const errors: MessageDraftErrors = {};
  const key = draft.key.trim();
  if (options.isNew && (!MESSAGE_KEY_PATTERN.test(key) || (RESERVED_MESSAGE_KEYS as readonly string[]).includes(key))) errors.key = key ? 'invalidKey' : 'required';
  const textAr = draft.textAr.trim();
  const textEn = draft.textEn.trim();
  if (!textAr) errors.textAr = 'required';
  if (!textEn) errors.textEn = 'required';
  const titleAr = draft.titleAr.trim();
  const titleEn = draft.titleEn.trim();
  if ((titleAr === '') !== (titleEn === '')) errors[titleAr ? 'titleEn' : 'titleAr'] = 'bothLanguages';
  const placement = draft.placement.trim();
  if (!placement) errors.placement = 'required';
  if (draft.audienceKind !== 'all' && draft.audienceValues.length === 0) errors.audienceValues = 'audienceEmpty';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      key,
      category: draft.category,
      type: draft.type,
      title: titleAr ? { ar: titleAr.slice(0, MESSAGE_TITLE_MAX), en: titleEn.slice(0, MESSAGE_TITLE_MAX) } : null,
      text: { ar: textAr.slice(0, MESSAGE_TEXT_MAX), en: textEn.slice(0, MESSAGE_TEXT_MAX) },
      placement: placement.slice(0, PLACEMENT_MAX),
      audience: draft.audienceKind === 'all' ? ALL : { kind: draft.audienceKind, values: draft.audienceValues.slice(0, 20) },
      isPublished: draft.isPublished,
    },
  };
}
