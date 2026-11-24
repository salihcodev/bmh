import { serverTimestamp, writeBatch } from '@react-native-firebase/firestore';

import { SUPPLIER_MESSAGE_MAX } from '@/domain/supplier';
import type { UserProfile } from '@/domain/user';
import { db } from '@/services/firebase/client';
import { refs } from '@/services/firebase/refs';
import { commitOnline } from '@/services/firebase/write';

/**
 * Asks to become a supplier. The request doc and `users/{uid}.supplierStatus = pending` go in one
 * batch: the rules check each against the other (getAfter).
 */
export async function requestSupplier(profile: UserProfile, message: string) {
  const batch = writeBatch(db);
  const text = message.trim().slice(0, SUPPLIER_MESSAGE_MAX);
  if (profile.supplierStatus === 'rejected') {
    batch.update(refs.supplierRequest(profile.id), { status: 'pending', message: text, updatedAt: serverTimestamp() });
  } else {
    batch.set(refs.supplierRequest(profile.id), {
      userId: profile.id,
      displayName: profile.displayName,
      email: profile.email ?? '',
      message: text,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  batch.update(refs.user(profile.id), { supplierStatus: 'pending', updatedAt: serverTimestamp() });
  await commitOnline(batch);
}
