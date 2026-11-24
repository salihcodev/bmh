import { useLocalSearchParams } from 'expo-router';

import { ComingSoon, Screen } from '@/components/ui';
import { AdminHeader } from '@/features/admin/admin-header';
import { useTranslation } from '@/localization';

const SECTIONS = ['cards', 'feedback', 'config'] as const;

/** Placeholder for Manage sections outside the minimum scope (docs/open-product-decisions.md). */
export default function ManageComingSoon() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const { t } = useTranslation();
  const key = (SECTIONS as readonly string[]).includes(section) ? section : 'config';
  return (
    <Screen scroll={false} header={<AdminHeader title={t(`manage.rows.${key}`)} />}>
      <ComingSoon hint={t(`manage.rows.${key}Hint`)} />
    </Screen>
  );
}
