import { getDocs, limit, query, where } from '@react-native-firebase/firestore';

import { confirmAsync } from '@/components/ui';
import type { BeneficiaryInput } from '@/domain/beneficiary';
import { normalizePhone } from '@/domain/phone';
import { i18n } from '@/localization';
import { refs } from '@/services/firebase/refs';

/** Returns the first other beneficiary sharing any of the phones (cache-only when offline). */
export async function findPhoneConflict(wid: string, input: BeneficiaryInput, excludeId?: string) {
  for (const phone of input.phones) {
    const result = normalizePhone(phone.raw);
    if (!result.ok) continue;
    try {
      const snapshot = await getDocs(
        query(refs.beneficiaries(wid), where('phoneDigits', 'array-contains', result.e164), limit(2)),
      );
      const other = snapshot.docs.find((d) => d.id !== excludeId);
      if (other) return { phone: result.e164, name: (other.data() as { fullName: string }).fullName };
    } catch {
      return null;
    }
  }
  return null;
}

/** Shared numbers are allowed (families share phones); the user just confirms. */
export function confirmDuplicate(name: string): Promise<boolean> {
  return confirmAsync({
    title: i18n.t('beneficiaries.duplicatePhone', { name }),
    confirmLabel: i18n.t('common.save'),
    cancelLabel: i18n.t('common.cancel'),
  });
}
