import { router, useLocalSearchParams } from 'expo-router';
import { Archive, ArchiveRestore, FileDown, Pencil, Phone as PhoneIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Badge, Button, Card, EmptyState, LoadingState, Row, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatPhone } from '@/domain/phone';
import { startCall } from '@/features/beneficiaries/call';
import { useBeneficiary } from '@/features/beneficiaries/use-beneficiaries';
import { AssistanceSection } from '@/features/assistance/assistance-section';
import { EventRow } from '@/features/history/event-row';
import { usePagedEvents } from '@/features/history/use-paged-events';
import { PinsSection } from '@/features/pins/pins-section';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { setBeneficiaryArchived } from '@/services/beneficiaries/api';
import { refs } from '@/services/firebase/refs';
import { formatDate } from '@/utils/format';

export default function BeneficiaryScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wid, actor } = useActiveWorkspace();
  const { beneficiary: b, fromCache } = useBeneficiary(wid, id);
  const canEdit = useCan('beneficiaries_edit');
  const canArchive = useCan('beneficiaries_archive');
  const canHistory = useCan('history_view');
  const canExport = useCan('beneficiaries_export');
  const historyRef = useMemo(() => (wid && id && canHistory ? refs.history(wid, id) : null), [wid, id, canHistory]);
  const history = usePagedEvents(historyRef);

  if (b === undefined) {
    return (
      <Screen header={<AppHeader title={t('beneficiaries.title')} back />}>
        <LoadingState />
      </Screen>
    );
  }
  if (b === null) {
    return (
      <Screen header={<AppHeader title={t('beneficiaries.title')} back />}>
        <EmptyState title={t('common.empty')} />
      </Screen>
    );
  }

  const toggleArchive = () =>
    Alert.alert(b.isArchived ? t('beneficiaries.restore') : t('beneficiaries.archive'), b.isArchived ? undefined : t('beneficiaries.archiveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: b.isArchived ? 'default' : 'destructive',
        onPress: () => {
          setBeneficiaryArchived(wid, b, !b.isArchived, actor);
          emitActionFeedback({
            message: t(b.isArchived ? 'beneficiaries.restoredDone' : 'beneficiaries.archivedDone'),
            kind: 'success',
          });
        },
      },
    ]);

  return (
    <Screen
      header={
        <AppHeader
          title={b.fullName}
          subtitle={[b.areaName, b.cityName].filter(Boolean).join(' · ')}
          back
        />
      }
    >
      {fromCache ? (
        <AppText variant="caption" style={{ color: colors.warning, marginBottom: Spacing.sm }}>
          {t('common.mayBeOutdated')}
        </AppText>
      ) : null}
      <Card style={styles.gap}>
        <Row wrap>
          <Badge label={t('beneficiaries.household', { count: b.householdCount })} tone="primary" />
          {b.isArchived ? <Badge label={t('beneficiaries.archived')} tone="warning" /> : null}
        </Row>
        <AppText variant="caption" muted>
          {b.lastConfirmedAssistanceAt
            ? t('beneficiaries.lastAssistance', { date: formatDate(b.lastConfirmedAssistanceAt.toDate()) })
            : t('beneficiaries.noAssistance')}
        </AppText>
        <Row wrap>
          {canEdit ? (
            <Button
              compact
              variant="secondary"
              title={t('common.edit')}
              icon={<Pencil size={16} />}
              onPress={() => router.push(`/beneficiaries/${b.id}/edit`)}
            />
          ) : null}
          {canArchive ? (
            <Button
              compact
              variant={b.isArchived ? 'secondary' : 'danger'}
              title={b.isArchived ? t('beneficiaries.restore') : t('beneficiaries.archive')}
              icon={b.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              onPress={toggleArchive}
            />
          ) : null}
          {canExport ? (
            <Button
              compact
              variant="ghost"
              title={t('home.export')}
              icon={<FileDown size={16} />}
              onPress={() => router.push(`/export?preset=profile&beneficiaryId=${b.id}`)}
            />
          ) : null}
        </Row>
      </Card>

      <Section title={t('beneficiaries.phones')}>
        <Card>
          {b.phones.length === 0 ? <AppText muted>{t('beneficiaries.noPhones')}</AppText> : null}
          {b.phones.map((phone) => (
            <View key={phone.id} style={[styles.phone, { borderBottomColor: colors.border }]}>
              <View style={styles.flex}>
                <AppText ltr>{formatPhone(phone.number)}</AppText>
                <AppText variant="caption" muted>
                  {[phone.label, phone.isPrimary ? t('beneficiaries.primary') : null].filter(Boolean).join(' · ')}
                </AppText>
              </View>
              <Button
                compact
                title={t('beneficiaries.call')}
                icon={<PhoneIcon size={16} />}
                onPress={() => startCall(wid, b.id, phone.number, actor)}
              />
            </View>
          ))}
          <AppText variant="caption" muted style={{ marginTop: Spacing.xs }}>
            {t('history.contactNote')}
          </AppText>
        </Card>
      </Section>

      <Section title={t('beneficiaries.locations')}>
        <Card style={styles.gap}>
          <Labeled label={t('beneficiaries.residentialAddress')} value={b.residentialAddress} />
          <Labeled label={t('beneficiaries.pickupLocation')} value={b.pickupLocation} />
          <Labeled label={t('beneficiaries.notes')} value={b.notes} />
        </Card>
      </Section>

      <PinsSection wid={wid} beneficiary={b} canEdit={canEdit} />

      <AssistanceSection wid={wid} beneficiary={b} />

      {canHistory ? (
        <Section title={t('beneficiaries.activity')}>
          <Card>
            {history.events.length === 0 ? (
              <AppText muted>{history.loading ? t('common.loading') : t('beneficiaries.noActivity')}</AppText>
            ) : (
              history.events.map((event) => <EventRow key={event.id} event={event} />)
            )}
            {!history.done && history.events.length > 0 ? (
              <Button title={t('common.loadMore')} variant="ghost" onPress={history.loadMore} />
            ) : null}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

function Labeled({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.sm },
  flex: { flex: 1 },
  phone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
