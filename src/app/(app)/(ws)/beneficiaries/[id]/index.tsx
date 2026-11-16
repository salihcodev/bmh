import { router, useLocalSearchParams } from 'expo-router';
import { Archive, ArchiveRestore, FileDown, Pencil, Phone as PhoneIcon, UserX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  InlineBanner,
  LoadingState,
  Screen,
  SectionHeader,
  SkeletonListRow,
  useDelayedLoading,
} from '@/components/ui';
import { formatPhone } from '@/domain/phone';
import { AssistanceSection } from '@/features/assistance/assistance-section';
import { startCall } from '@/features/beneficiaries/call';
import { useBeneficiary } from '@/features/beneficiaries/use-beneficiaries';
import { EventRow } from '@/features/history/event-row';
import { usePagedEvents } from '@/features/history/use-paged-events';
import { PinsSection } from '@/features/pins/pins-section';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { setBeneficiaryArchived } from '@/services/beneficiaries/api';
import { refs } from '@/services/firebase/refs';
import { sizes, spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

export default function BeneficiaryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wid, actor } = useActiveWorkspace();
  const { beneficiary: b, fromCache } = useBeneficiary(wid, id);
  const canEdit = useCan('beneficiaries_edit');
  const canArchive = useCan('beneficiaries_archive');
  const canHistory = useCan('history_view');
  const canExport = useCan('beneficiaries_export');
  const historyRef = useMemo(() => (wid && id && canHistory ? refs.history(wid, id) : null), [wid, id, canHistory]);
  const history = usePagedEvents(historyRef);
  const showHistorySkeleton = useDelayedLoading(history.status === 'loading');
  const [confirm, setConfirm] = useState(false);

  if (b === undefined) {
    return (
      <Screen scroll={false} header={<AppHeader title={t('beneficiaries.title')} back />}>
        <LoadingState />
      </Screen>
    );
  }
  if (b === null) {
    return (
      <Screen scroll={false} header={<AppHeader title={t('beneficiaries.title')} back />}>
        <EmptyState icon={UserX} title={t('common.empty')} />
      </Screen>
    );
  }

  const place = [b.areaName, b.cityName].filter(Boolean).join(' · ');

  return (
    <Screen header={<AppHeader title={t('beneficiaries.title')} back />} contentStyle={styles.content}>
      {fromCache ? <InlineBanner tone="offline" message={t('common.mayBeOutdated')} /> : null}

      <Card style={styles.identity}>
        <Avatar name={b.fullName} size={sizes.avatarMd} />
        <AppText variant="h2" center>
          {b.fullName}
        </AppText>
        {place ? (
          <AppText variant="bodySm" tone="secondary" center>
            {place}
          </AppText>
        ) : null}
        <View style={styles.tags}>
          <Badge label={t('beneficiaries.household', { count: b.householdCount })} tone="lime" />
          {b.isArchived ? <Badge label={t('beneficiaries.archived')} tone="warning" /> : null}
        </View>
        <AppText variant="caption" tone="secondary" center>
          {b.lastConfirmedAssistanceAt
            ? t('beneficiaries.lastAssistance', { date: formatDate(b.lastConfirmedAssistanceAt.toDate()) })
            : t('beneficiaries.noAssistance')}
        </AppText>
        <View style={styles.actions}>
          {canEdit ? (
            <Button
              compact
              fullWidth={false}
              variant="secondary"
              title={t('common.edit')}
              icon={<Pencil />}
              onPress={() => router.push(`/beneficiaries/${b.id}/edit`)}
            />
          ) : null}
          {canExport ? (
            <Button
              compact
              fullWidth={false}
              variant="secondary"
              title={t('home.export')}
              icon={<FileDown />}
              onPress={() => router.push(`/export?preset=profile&beneficiaryId=${b.id}`)}
            />
          ) : null}
          {canArchive ? (
            <Button
              compact
              fullWidth={false}
              variant={b.isArchived ? 'secondary' : 'ghost'}
              title={b.isArchived ? t('beneficiaries.restore') : t('beneficiaries.archive')}
              icon={b.isArchived ? <ArchiveRestore /> : <Archive />}
              onPress={() => setConfirm(true)}
            />
          ) : null}
        </View>
      </Card>

      <View>
        <SectionHeader title={t('beneficiaries.phones')} />
        <Card style={styles.group}>
          {b.phones.length === 0 ? (
            <AppText variant="bodySm" tone="secondary">
              {t('beneficiaries.noPhones')}
            </AppText>
          ) : null}
          {b.phones.map((phone, index) => (
            <View
              key={phone.id}
              style={[styles.phone, index < b.phones.length - 1 && { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}
            >
              <View style={styles.flex}>
                <AppText variant="body" weight="semibold" ltr>
                  {formatPhone(phone.number)}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {[phone.label, phone.isPrimary ? t('beneficiaries.primary') : null].filter(Boolean).join(' · ')}
                </AppText>
              </View>
              <Button
                compact
                fullWidth={false}
                variant="lime"
                title={t('beneficiaries.call')}
                icon={<PhoneIcon />}
                onPress={() => startCall(wid, b.id, phone.number, actor)}
              />
            </View>
          ))}
          <AppText variant="caption" tone="tertiary">
            {t('history.contactNote')}
          </AppText>
        </Card>
      </View>

      {b.residentialAddress || b.pickupLocation || b.notes ? (
        <View>
          <SectionHeader title={t('beneficiaries.locations')} />
          <Card style={styles.group}>
            <Labeled label={t('beneficiaries.residentialAddress')} value={b.residentialAddress} />
            <Labeled label={t('beneficiaries.pickupLocation')} value={b.pickupLocation} />
            <Labeled label={t('beneficiaries.notes')} value={b.notes} />
          </Card>
        </View>
      ) : null}

      <PinsSection wid={wid} beneficiary={b} canEdit={canEdit} />

      <AssistanceSection wid={wid} beneficiary={b} />

      {canHistory ? (
        <View>
          <SectionHeader title={t('beneficiaries.activity')} />
          {history.status === 'loading' ? (
            showHistorySkeleton ? <SkeletonListRow /> : null
          ) : history.status === 'error' ? (
            <InlineBanner tone="danger" message={t('states.pageFailed')} actionLabel={t('common.retry')} onAction={history.refresh} />
          ) : !history.items?.length ? (
            <Card>
              <AppText variant="bodySm" tone="secondary" center>
                {t('beneficiaries.noActivity')}
              </AppText>
            </Card>
          ) : (
            <Card>
              {history.items.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
              {history.moreError ? (
                <InlineBanner tone="danger" message={t('states.pageFailed')} actionLabel={t('common.retry')} onAction={history.loadMore} />
              ) : !history.done ? (
                <Button title={t('common.loadMore')} variant="ghost" loading={history.loadingMore} onPress={history.loadMore} />
              ) : null}
            </Card>
          )}
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirm}
        title={b.isArchived ? t('beneficiaries.restore') : t('beneficiaries.archive')}
        message={b.isArchived ? undefined : t('beneficiaries.archiveConfirm')}
        confirmLabel={b.isArchived ? t('beneficiaries.restore') : t('beneficiaries.archive')}
        cancelLabel={t('common.cancel')}
        destructive={!b.isArchived}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setBeneficiaryArchived(wid, b, !b.isArchived, actor);
          emitActionFeedback({
            message: t(b.isArchived ? 'beneficiaries.restoredDone' : 'beneficiaries.archivedDone'),
            kind: 'success',
          });
          setConfirm(false);
        }}
      />
    </Screen>
  );
}

function Labeled({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.labeled}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="body">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5] },
  identity: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[5] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'center', marginTop: spacing[2] },
  group: { gap: spacing[3] },
  flex: { flex: 1 },
  phone: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingBottom: spacing[3] },
  labeled: { gap: spacing[1] / 2 },
});
