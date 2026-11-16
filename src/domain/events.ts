export const BENEFICIARY_EVENTS = [
  'beneficiary_created',
  'beneficiary_updated',
  'notes_updated',
  'phone_added',
  'phone_updated',
  'phone_removed',
  'primary_phone_changed',
  'pin_added',
  'pin_updated',
  'pin_removed',
  'address_changed',
  'pickup_changed',
  'area_changed',
  'archived',
  'restored',
  'session_checked',
  'session_ignored',
  'session_reopened',
  'call_initiated',
  'assistance_recorded',
  'assistance_confirmed',
  'imported',
] as const;

export const SESSION_EVENTS = [
  'session_created',
  'session_started',
  'session_ended',
  'operator_reassigned',
  'checked',
  'ignored',
  'reopened',
  'note_updated',
  'call_initiated',
  'beneficiary_edited',
] as const;

export const AUDIT_EVENTS = [
  'workspace_created',
  'member_joined',
  'member_updated',
  'member_removed',
  'member_left',
  'invite_created',
  'invite_used',
  'invite_revoked',
  'ownership_transferred',
  'import_completed',
  'export_created',
  'counters_recounted',
] as const;

export type BeneficiaryEventType = (typeof BENEFICIARY_EVENTS)[number];
export type SessionEventType = (typeof SESSION_EVENTS)[number];
export type AuditEventType = (typeof AUDIT_EVENTS)[number];

/** Compares two beneficiary snapshots and returns the most specific event types for the change. */
export function diffBeneficiaryEvents(
  before: {
    fullName?: string;
    householdCount?: number;
    notes?: string | null;
    residentialAddress?: string | null;
    pickupLocation?: string | null;
    areaId?: string;
    primaryPhone?: string | null;
    phones?: { id: string; number: string; label?: string | null }[];
    mapPins?: { id: string; lat: number; lng: number; label?: string | null; description?: string | null }[];
  },
  after: typeof before,
): BeneficiaryEventType[] {
  const types = new Set<BeneficiaryEventType>();
  if (before.fullName !== after.fullName || before.householdCount !== after.householdCount) {
    types.add('beneficiary_updated');
  }
  if ((before.notes ?? '') !== (after.notes ?? '')) types.add('notes_updated');
  if ((before.residentialAddress ?? '') !== (after.residentialAddress ?? '')) types.add('address_changed');
  if ((before.pickupLocation ?? '') !== (after.pickupLocation ?? '')) types.add('pickup_changed');
  if (before.areaId !== after.areaId) types.add('area_changed');

  const beforePhones = new Map((before.phones ?? []).map((p) => [p.id, p]));
  const afterPhones = new Map((after.phones ?? []).map((p) => [p.id, p]));
  for (const [id, phone] of afterPhones) {
    const old = beforePhones.get(id);
    if (!old) types.add('phone_added');
    else if (old.number !== phone.number || (old.label ?? '') !== (phone.label ?? '')) types.add('phone_updated');
  }
  for (const id of beforePhones.keys()) if (!afterPhones.has(id)) types.add('phone_removed');
  if ((before.primaryPhone ?? null) !== (after.primaryPhone ?? null) && beforePhones.size > 0 && afterPhones.size > 0) {
    types.add('primary_phone_changed');
  }

  const beforePins = new Map((before.mapPins ?? []).map((p) => [p.id, p]));
  const afterPins = new Map((after.mapPins ?? []).map((p) => [p.id, p]));
  for (const [id, pin] of afterPins) {
    const old = beforePins.get(id);
    if (!old) types.add('pin_added');
    else if (
      old.lat !== pin.lat ||
      old.lng !== pin.lng ||
      (old.label ?? '') !== (pin.label ?? '') ||
      (old.description ?? '') !== (pin.description ?? '')
    ) {
      types.add('pin_updated');
    }
  }
  for (const id of beforePins.keys()) if (!afterPins.has(id)) types.add('pin_removed');

  return [...types];
}
