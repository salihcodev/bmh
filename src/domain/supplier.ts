export const SUPPLIER_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type SupplierRequestStatus = (typeof SUPPLIER_REQUEST_STATUSES)[number];

export const SUPPLIER_MESSAGE_MAX = 1000;

/** `supplierRequests/{uid}`: one request per user, reopened after a rejection. */
export type SupplierRequest = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  message: string;
  status: SupplierRequestStatus;
  reason: string | null;
  reviewedBy: string | null;
  createdAt: number | null;
  reviewedAt: number | null;
};

function toMillis(value: unknown): number | null {
  const v = value as { toMillis?: () => number } | null;
  return typeof v?.toMillis === 'function' ? v.toMillis() : null;
}

export function normalizeSupplierRequest(id: string, data: Record<string, unknown>): SupplierRequest {
  const status = SUPPLIER_REQUEST_STATUSES.includes(data.status as SupplierRequestStatus)
    ? (data.status as SupplierRequestStatus)
    : 'pending';
  return {
    id,
    userId: id,
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    email: typeof data.email === 'string' ? data.email : '',
    message: typeof data.message === 'string' ? data.message : '',
    status,
    reason: typeof data.reason === 'string' ? data.reason : null,
    reviewedBy: typeof data.reviewedBy === 'string' ? data.reviewedBy : null,
    createdAt: toMillis(data.createdAt),
    reviewedAt: toMillis(data.reviewedAt),
  };
}
