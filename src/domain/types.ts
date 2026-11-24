import type { Timestamp } from '@react-native-firebase/firestore';

import type { SystemPermission, WorkspacePermission } from '@/services/permissions/catalog';

export type Workspace = {
  id: string;
  name: string;
  description?: string | null;
  /** The creator. Holds the locked `admin` role; changes only through ownership transfer. */
  ownerId: string;
  beneficiaryCount: number;
  areaCount: number;
  cityCount: number;
  sessionCount: number;
  isArchived?: boolean;
  isDeleted?: boolean;
  createdAt?: Timestamp | null;
};

export type Member = {
  id: string;
  userId: string;
  /** `admin` (built-in, every workspace key), `member` (built-in) or a custom role id. */
  roleId: string;
  status: 'active' | 'disabled';
  joinedAt?: Timestamp | null;
  inviteCode?: string | null;
  displayName: string;
  email: string;
};

export type WorkspaceRole = {
  id: string;
  name: string;
  permissions: WorkspacePermission[];
  isLocked: boolean;
  isDeleted: boolean;
  createdAt?: Timestamp | null;
};

export type SystemRole = {
  id: string;
  name: { ar: string; en: string };
  permissions: SystemPermission[];
  isLocked: boolean;
  isDeleted: boolean;
};

export type Invite = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  roleId: string;
  /** Shown to the invitee, who cannot read the workspace roles before joining. */
  roleName: string;
  createdBy: string;
  createdAt?: Timestamp | null;
  expiresAt: Timestamp;
  used: boolean;
  usedBy: string | null;
};

export type City = {
  id: string;
  name: string;
  nameSearch: string;
  isArchived: boolean;
  createdAt?: Timestamp | null;
  createdBy: string;
};

export type Area = {
  id: string;
  name: string;
  nameSearch: string;
  cityId: string;
  cityName: string;
  description?: string | null;
  isActive: boolean;
  beneficiaryCount: number;
  createdAt?: Timestamp | null;
  createdBy: string;
};

export type Phone = {
  id: string;
  /** E.164 */
  number: string;
  raw: string;
  label?: string | null;
  isPrimary: boolean;
  createdAt: Timestamp;
};

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label?: string | null;
  description?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
};

export type Beneficiary = {
  id: string;
  workspaceId: string;
  fullName: string;
  nameSearch: string;
  householdCount: number;
  cityId: string;
  cityName: string;
  areaId: string;
  areaName: string;
  residentialAddress?: string | null;
  pickupLocation?: string | null;
  notes?: string | null;
  phones: Phone[];
  primaryPhone: string | null;
  phoneDigits: string[];
  mapPins: MapPin[];
  lastConfirmedAssistanceAt?: Timestamp | null;
  lastConfirmedAssistanceRecordId?: string | null;
  isArchived: boolean;
  archivedAt?: Timestamp | null;
  extra?: Record<string, unknown>;
  schemaVersion: number;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  updatedBy?: string | null;
};

export type AssistanceType = 'food' | 'cash' | 'clothes' | 'medical' | 'bag' | 'other';

export type AssistanceRecord = {
  id: string;
  workspaceId: string;
  beneficiaryId: string;
  type: AssistanceType;
  description?: string | null;
  sessionId?: string | null;
  bagId?: string | null;
  deliveredAt: Timestamp;
  recordedBy: string;
  recordedByName?: string;
  notes?: string | null;
  confirmationStatus: 'unconfirmed' | 'confirmed';
  confirmedAt?: Timestamp | null;
  confirmedBy?: string | null;
  createdAt?: Timestamp | null;
  clientAt?: Timestamp | null;
};

export type SessionStatus = 'draft' | 'active' | 'ended';
export type ItemStatus = 'pending' | 'checked' | 'ignored';

export type Session = {
  id: string;
  workspaceId: string;
  name: string;
  cityId: string;
  cityName: string;
  areaIds: string[];
  areaNames: string[];
  status: SessionStatus;
  createdBy: string;
  operatorId: string;
  operatorName?: string;
  startedBy: string;
  startedAt?: Timestamp | null;
  endedAt?: Timestamp | null;
  endedBy?: string | null;
  beneficiaryCount: number;
  checkedCount: number;
  ignoredCount: number;
  pendingCount: number;
  contactActionsCount: number;
  summary?: Record<string, unknown> | null;
  createdAt?: Timestamp | null;
  clientAt?: Timestamp | null;
  lastProcessedAt?: Timestamp | null;
  isDeleted?: boolean;
};

export type SessionItem = {
  id: string;
  beneficiaryId: string;
  order: number;
  fullName: string;
  householdCount: number;
  primaryPhone: string | null;
  phones: Phone[];
  areaId: string;
  areaName: string;
  pickupLocation?: string | null;
  residentialAddress?: string | null;
  notes?: string | null;
  mapPins: MapPin[];
  status: ItemStatus;
  processedAt: Timestamp | null;
  processedBy: string | null;
  processedClientAt?: Timestamp | null;
  note?: string | null;
};

export type EventRecord = {
  id: string;
  workspaceId: string;
  sessionId?: string | null;
  beneficiaryId?: string | null;
  actorId: string;
  actorName: string;
  type: string;
  createdAt?: Timestamp | null;
  clientAt?: Timestamp | null;
  metadata?: Record<string, unknown>;
};
