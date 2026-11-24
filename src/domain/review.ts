export type SupplierReview = {
  id: string;
  rating: number;
  text: string;
  reviewerName: string;
  reviewerAvatarPublicId: string | null;
  isHidden: boolean;
  createdAt: number | null;
  updatedAt: number | null;
};

export type ReviewPayload = {
  rating: number;
  text: string;
  reviewerName: string;
  reviewerAvatarPublicId?: string | null;
};

export function clampRating(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function canReviewSupplier(viewerUid: string | null | undefined, supplierId: string): boolean {
  return Boolean(viewerUid) && viewerUid !== supplierId;
}

export function ratingDelta(before: number | null, after: number): { sum: number; count: number } {
  if (before == null) return { sum: after, count: 1 };
  return { sum: after - before, count: 0 };
}

export function hideDelta(rating: number, hiding: boolean): { sum: number; count: number } {
  return hiding ? { sum: -rating, count: -1 } : { sum: rating, count: 1 };
}

function toMillis(value: unknown): number | null {
  const v = value as { toMillis?: () => number } | null;
  return typeof v?.toMillis === 'function' ? v.toMillis() : null;
}

export function normalizeReview(id: string, data: Record<string, unknown>): SupplierReview {
  return {
    id,
    rating: clampRating(typeof data.rating === 'number' ? data.rating : 1),
    text: typeof data.text === 'string' ? data.text : '',
    reviewerName: typeof data.reviewerName === 'string' ? data.reviewerName : '',
    reviewerAvatarPublicId: typeof data.reviewerAvatarPublicId === 'string' ? data.reviewerAvatarPublicId : null,
    isHidden: data.isHidden === true,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

export function buildReviewWrite(input: ReviewPayload) {
  return {
    rating: clampRating(input.rating),
    text: input.text.trim().slice(0, 1000),
    reviewerName: input.reviewerName.trim().slice(0, 120),
    reviewerAvatarPublicId: input.reviewerAvatarPublicId ?? null,
    isHidden: false,
  };
}
