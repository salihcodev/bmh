import type { ReactNode } from 'react';

import { SurfaceSwitch, useShowSurfaceSwitch } from '@/components/layout/surface-switch';
import { Header, InlineBanner } from '@/components/ui';
import { useTranslation } from '@/localization';
import { useConnectivity } from '@/services/sync/connectivity';

/** Header for every Manage screen: the lime SUPER ADMIN tag plus an offline notice (admin writes are online only). */
export function AdminHeader({ title, back = true, trailing }: { title: string; back?: boolean; trailing?: ReactNode }) {
  const { t } = useTranslation();
  const isOnline = useConnectivity((s) => s.isOnline);
  const showSwitch = useShowSurfaceSwitch();
  const slot = trailing || showSwitch ? (
    <>
      {trailing}
      {showSwitch ? <SurfaceSwitch /> : null}
    </>
  ) : undefined;
  return (
    <>
      <Header title={title} back={back} tag={t('manage.tag')} trailing={slot} />
      {!isOnline ? <InlineBanner tone="offline" message={t('manage.offline')} /> : null}
    </>
  );
}
