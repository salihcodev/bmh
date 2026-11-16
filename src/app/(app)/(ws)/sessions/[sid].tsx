import { router, useLocalSearchParams } from 'expo-router';
import { Check, FileDown, Flag, RotateCcw, UserCog, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  LoadingState,
  Row,
  Screen,
  SearchField,
  Section,
  Select,
  Sheet,
} from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { matchesName } from '@/domain/search';
import { countItems, nextPendingId } from '@/domain/session';
import { SESSION_CONFIG } from '@/domain/session-config';
import type { ItemStatus, Session, SessionItem } from '@/domain/types';
import { useMembers } from '@/features/members/use-members';
import { ItemCard } from '@/features/sessions/item-card';
import { ProgressBar } from '@/features/sessions/session-card';
import { usePrefetchSessionBeneficiaries, useSession, useSessionItems } from '@/features/sessions/use-sessions';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import {
  endSession,
  logSessionCall,
  processItem,
  reassignOperator,
  reopenItem,
  saveItemNote,
} from '@/services/sessions/api';
import { OfflineError } from '@/services/sync/connectivity';
import { formatDateTime } from '@/utils/format';

type Tab = 'current' | 'list' | 'ignored';

export default function SessionScreen() {
  const { t } = useTranslation();
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const { wid } = useActiveWorkspace();
  const session = useSession(wid, sid);
  const items = useSessionItems(wid, sid);

  if (session === undefined || items === null) {
    return (
      <Screen header={<AppHeader title={t('sessions.title')} back />}>
        <LoadingState />
      </Screen>
    );
  }
  if (session === null) {
    return (
      <Screen header={<AppHeader title={t('sessions.title')} back />}>
        <EmptyState title={t('common.empty')} />
      </Screen>
    );
  }
  return <Runner session={session} items={items} />;
}

function Runner({ session, items }: { session: Session; items: SessionItem[] }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { wid, actor } = useActiveWorkspace();
  const canReassign = useCan('sessions_reassign');
  const canViewBeneficiaries = useCan('beneficiaries_view');
  const canExport = useCan('beneficiaries_export');
  usePrefetchSessionBeneficiaries(wid, session, items, canViewBeneficiaries);
  const members = useMembers(wid);
  const names = useMemo(() => new Map((members ?? []).map((m) => [m.id, m.displayName])), [members]);

  const [tab, setTab] = useState<Tab>('current');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState(-1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all');
  const [sheet, setSheet] = useState<'note' | 'reassign' | null>(null);
  // Per-item lock: a second tap before the local snapshot updates must not double-process.
  const locks = useRef(new Set<string>());

  const active = session.status === 'active';
  const isOperator = session.operatorId === actor.uid;
  const canOperate = active && (isOperator || canReassign);
  const ctx = { wid, session, actor, logHistory: canViewBeneficiaries };
  const counts = countItems(items);
  const done = counts.checked + counts.ignored;

  const selected = selectedId ? items.find((i) => i.id === selectedId) : undefined;
  const nextId = nextPendingId(items, lastOrder);
  const current = selected ?? (nextId ? items.find((i) => i.id === nextId) : undefined);

  const act = (item: SessionItem, status: 'checked' | 'ignored') => {
    if (locks.current.has(item.id) || item.status !== 'pending') return;
    locks.current.add(item.id);
    processItem(ctx, item, status);
    setLastOrder(item.order);
    setSelectedId(null);
    setTimeout(() => locks.current.delete(item.id), 1500);
  };

  const reopen = (item: SessionItem) => {
    reopenItem(ctx, item);
    emitActionFeedback({ message: t('sessions.reopened'), kind: 'success' });
  };

  const call = async (item: SessionItem, phone: string) => {
    try {
      await Linking.openURL(`tel:${phone}`);
      logSessionCall(ctx, item, phone);
    } catch {
      emitActionFeedback({ message: t('errors.generic'), kind: 'error' });
    }
  };

  const end = () =>
    Alert.alert(t('sessions.end'), t('sessions.endConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sessions.end'),
        style: 'destructive',
        onPress: () => {
          endSession(ctx, items);
          emitActionFeedback({ message: t('sessions.ended'), kind: 'success' });
        },
      },
    ]);

  const filtered = items.filter(
    (i) =>
      (tab === 'ignored' ? i.status === 'ignored' : statusFilter === 'all' || i.status === statusFilter) &&
      matchesName(i.fullName, search),
  );

  return (
    <Screen
      header={
        <AppHeader
          title={session.name}
          subtitle={`${t(`sessions.status.${session.status}`)} · ${t('sessions.operator')}: ${names.get(session.operatorId) ?? '…'}`}
          back
        />
      }
      footer={
        canOperate && tab === 'current' && current?.status === 'pending' ? (
          <View style={[styles.actions, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(SESSION_CONFIG.ignoreLabelKey)}
              onPress={() => act(current, 'ignored')}
              style={({ pressed }) => [styles.action, { backgroundColor: colors.warningSoft, opacity: pressed ? 0.8 : 1 }]}
            >
              <X size={26} color={colors.warning} />
              <AppText style={[styles.actionText, { color: colors.warning }]}>{t(SESSION_CONFIG.ignoreLabelKey)}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(SESSION_CONFIG.checkLabelKey)}
              onPress={() => act(current, 'checked')}
              style={({ pressed }) => [styles.action, styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Check size={28} color={colors.onPrimary} />
              <AppText style={[styles.actionText, { color: colors.onPrimary }]}>{t(SESSION_CONFIG.checkLabelKey)}</AppText>
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <Card style={{ gap: Spacing.xs }}>
        <ProgressBar done={done} total={counts.total} />
        <AppText variant="label">{t('sessions.progress', { done, total: counts.total })}</AppText>
        <Row wrap>
          <Badge label={t('sessions.checkedCount', { count: counts.checked })} tone="success" />
          <Badge label={t('sessions.ignoredCount', { count: counts.ignored })} tone="warning" />
          <Badge label={t('sessions.pendingCount', { count: counts.pending })} />
          <Badge label={t('sessions.contactsCount', { count: session.contactActionsCount ?? 0 })} tone="primary" />
        </Row>
        {!active ? (
          <AppText variant="caption" muted>
            {`${t('sessions.readOnly')} · ${t('sessions.endedAt')}: ${formatDateTime(session.endedAt?.toDate())}`}
          </AppText>
        ) : !isOperator ? (
          <AppText variant="caption" style={{ color: colors.warning }}>
            {t('sessions.notOperator', { name: names.get(session.operatorId) ?? '…' })}
          </AppText>
        ) : null}
      </Card>

      <Row wrap>
        {(['current', 'list', 'ignored'] as const).map((key) => (
          <Chip
            key={key}
            label={key === 'current' ? t('sessions.current') : key === 'list' ? t('sessions.list') : `${t('sessions.ignoredList')} (${counts.ignored})`}
            selected={tab === key}
            onPress={() => setTab(key)}
          />
        ))}
      </Row>

      {tab === 'current' ? (
        current ? (
          <View style={{ marginTop: Spacing.md }}>
            <ItemCard
              item={current}
              total={counts.total}
              canViewDetails={canViewBeneficiaries}
              onCall={canOperate ? (phone) => void call(current, phone) : undefined}
              onNote={canOperate ? () => setSheet('note') : undefined}
            />
            {canOperate && current.status === 'ignored' ? (
              <Button title={t('sessions.reopen')} variant="secondary" icon={<RotateCcw size={18} />} onPress={() => reopen(current)} />
            ) : null}
          </View>
        ) : (
          <EmptyState title={t('sessions.allProcessed')} />
        )
      ) : (
        <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
          <SearchField placeholder={t('common.search')} value={search} onChangeText={setSearch} />
          {tab === 'list' ? (
            <Row wrap>
              {(['all', 'pending', 'checked', 'ignored'] as const).map((key) => (
                <Chip
                  key={key}
                  label={key === 'all' ? t('common.all') : t(`sessions.itemStatus.${key}`)}
                  selected={statusFilter === key}
                  onPress={() => setStatusFilter(key)}
                />
              ))}
            </Row>
          ) : null}
          {filtered.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => {
                setSelectedId(item.id);
                setTab('current');
              }}
              style={[styles.listRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <AppText variant="caption" muted>{`#${item.order + 1}`}</AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="label">{item.fullName}</AppText>
                <AppText variant="caption" muted>
                  {item.areaName}
                </AppText>
              </View>
              <Badge
                label={t(`sessions.itemStatus.${item.status}`)}
                tone={item.status === 'checked' ? 'success' : item.status === 'ignored' ? 'warning' : 'neutral'}
              />
              {canOperate && item.status === 'ignored' ? (
                <Button compact variant="secondary" title={t('sessions.reopen')} onPress={() => reopen(item)} />
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      <Section title={t('sessions.report')}>
        <Row wrap>
          {canOperate ? <Button title={t('sessions.end')} variant="danger" icon={<Flag size={18} />} onPress={end} /> : null}
          {active && canReassign ? (
            <Button title={t('sessions.reassign')} variant="secondary" icon={<UserCog size={18} />} onPress={() => setSheet('reassign')} />
          ) : null}
          {canExport ? (
            <Button
              title={t('sessions.exportReport')}
              variant="secondary"
              icon={<FileDown size={18} />}
              onPress={() => router.push(`/export?preset=session&sessionId=${session.id}`)}
            />
          ) : null}
        </Row>
      </Section>

      {current ? (
        <NoteSheet
          key={`${current.id}-${sheet}`}
          visible={sheet === 'note'}
          initial={current.note ?? ''}
          onClose={() => setSheet(null)}
          onSave={(note) => {
            saveItemNote(ctx, current, note);
            emitActionFeedback({ message: t('sessions.noteSaved'), kind: 'success' });
            setSheet(null);
          }}
        />
      ) : null}
      <ReassignSheet
        visible={sheet === 'reassign'}
        session={session}
        members={(members ?? []).filter((m) => m.status === 'active')}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

function NoteSheet({ visible, initial, onClose, onSave }: { visible: boolean; initial: string; onClose: () => void; onSave: (note: string) => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState(initial);
  return (
    <Sheet visible={visible} title={t('sessions.note')} onClose={onClose}>
      <Field label={t('sessions.note')} multiline value={note} onChangeText={setNote} maxLength={1000} />
      <Button title={t('common.save')} onPress={() => onSave(note)} />
    </Sheet>
  );
}

function ReassignSheet({
  visible,
  session,
  members,
  onClose,
}: {
  visible: boolean;
  session: Session;
  members: { id: string; displayName: string }[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { wid, actor } = useActiveWorkspace();
  const [target, setTarget] = useState<string | null>(null);
  return (
    <Sheet visible={visible} title={t('sessions.reassign')} onClose={onClose}>
      <Select
        label={t('sessions.reassignTo')}
        value={target}
        options={members.filter((m) => m.id !== session.operatorId).map((m) => ({ value: m.id, label: m.displayName }))}
        onChange={setTarget}
      />
      <Button
        title={t('common.confirm')}
        disabled={!target}
        onPress={async () => {
          if (!target) return;
          try {
            await reassignOperator(wid, session, target, actor);
            emitActionFeedback({ message: t('sessions.reassigned'), kind: 'success' });
            onClose();
          } catch (error) {
            emitActionFeedback({
              message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error),
              kind: 'error',
            });
          }
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: {
    flex: 1,
    minHeight: 64,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primary: { flex: 2 },
  actionText: { fontSize: 20, fontWeight: '700' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
