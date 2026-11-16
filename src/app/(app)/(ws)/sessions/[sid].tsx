import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, CircleCheckBig, FileDown, Flag, MoreHorizontal, RotateCcw, SearchX, UserCog, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import {
  AppText,
  Badge,
  BottomSheet,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  GroupedList,
  IconButton,
  InlineBanner,
  ListRow,
  LoadingState,
  ProgressBar,
  Screen,
  SearchField,
  Select,
} from '@/components/ui';
import { matchesName } from '@/domain/search';
import { countItems, nextPendingId } from '@/domain/session';
import { SESSION_CONFIG } from '@/domain/session-config';
import type { ItemStatus, Session, SessionItem } from '@/domain/types';
import { useMembers } from '@/features/members/use-members';
import { ItemCard } from '@/features/sessions/item-card';
import { usePrefetchSessionBeneficiaries, useSession, useSessionItems } from '@/features/sessions/use-sessions';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { endSession, logSessionCall, processItem, reassignOperator, reopenItem, saveItemNote } from '@/services/sessions/api';
import { OfflineError } from '@/services/sync/connectivity';
import { iconStroke, motion, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

type Tab = 'current' | 'list' | 'ignored';

const haptic = (kind: 'check' | 'ignore' | 'finished') => {
  const run =
    kind === 'finished'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(kind === 'check' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  run.catch(() => undefined);
};

export default function SessionScreen() {
  const { t } = useTranslation();
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const { wid } = useActiveWorkspace();
  const session = useSession(wid, sid);
  const { items, error, retry } = useSessionItems(wid, sid);

  if (session === undefined || session === null || items === null) {
    return (
      <Screen scroll={false} header={<AppHeader title={t('sessions.title')} back />}>
        {session === null ? (
          <EmptyState title={t('common.empty')} />
        ) : error ? (
          <ErrorState message={t('sessions.itemsFailed')} onRetry={retry} />
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }
  return <Runner session={session} items={items} />;
}

function Runner({ session, items }: { session: Session; items: SessionItem[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
  const [sheet, setSheet] = useState<'note' | 'reassign' | 'menu' | 'end' | null>(null);
  // Per-item lock: a second tap before the local snapshot updates must not double-process.
  const locks = useRef(new Set<string>());

  const active = session.status === 'active';
  const isOperator = session.operatorId === actor.uid;
  const canOperate = active && (isOperator || canReassign);
  const ctx = { wid, session, actor, logHistory: canViewBeneficiaries };
  const counts = countItems(items);
  const done = counts.checked + counts.ignored;
  const operatorName = names.get(session.operatorId) ?? '…';

  const selected = selectedId ? items.find((i) => i.id === selectedId) : undefined;
  const nextId = nextPendingId(items, lastOrder);
  const current = selected ?? (nextId ? items.find((i) => i.id === nextId) : undefined);

  const act = (item: SessionItem, status: 'checked' | 'ignored') => {
    if (locks.current.has(item.id) || item.status !== 'pending') return;
    locks.current.add(item.id);
    processItem(ctx, item, status);
    haptic(counts.pending <= 1 ? 'finished' : status === 'checked' ? 'check' : 'ignore');
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

  const filtered = items.filter(
    (i) =>
      (tab === 'ignored' ? i.status === 'ignored' : statusFilter === 'all' || i.status === statusFilter) &&
      matchesName(i.fullName, search),
  );
  const hasMenu = canOperate || (active && canReassign) || canExport;
  const thumbZone = canOperate && tab === 'current' && current?.status === 'pending';

  return (
    <Screen
      header={
        <View>
          <AppHeader
            title={session.name}
            subtitle={`${t(`sessions.status.${session.status}`)} · ${t('sessions.operator')}: ${operatorName}`}
            back
            right={hasMenu ? <IconButton icon={MoreHorizontal} label={t('sessions.actions')} onPress={() => setSheet('menu')} /> : undefined}
          />
          <View style={styles.progress}>
            <View style={styles.progressHead}>
              <AppText variant="h3" ltr>{`${done} / ${counts.total}`}</AppText>
              <AppText variant="caption" tone="secondary" style={styles.flex} numberOfLines={1}>
                {[
                  t('sessions.checkedCount', { count: counts.checked }),
                  t('sessions.ignoredCount', { count: counts.ignored }),
                  t('sessions.pendingCount', { count: counts.pending }),
                ].join(' · ')}
              </AppText>
            </View>
            <ProgressBar value={counts.total ? done / counts.total : 0} label={t('sessions.progress', { done, total: counts.total })} />
          </View>
        </View>
      }
      contentStyle={styles.content}
      footer={
        thumbZone ? (
          <View style={styles.thumb}>
            <ThumbAction kind="ignore" label={t(SESSION_CONFIG.ignoreLabelKey)} onPress={() => act(current, 'ignored')} />
            <ThumbAction kind="check" label={t(SESSION_CONFIG.checkLabelKey)} onPress={() => act(current, 'checked')} />
          </View>
        ) : undefined
      }
    >
      {!active ? (
        <InlineBanner tone="info" message={`${t('sessions.readOnly')} · ${t('sessions.endedAt')}: ${formatDateTime(session.endedAt?.toDate())}`} />
      ) : !isOperator ? (
        <InlineBanner tone="warning" message={t('sessions.notOperator', { name: operatorName })} />
      ) : null}

      <View style={styles.chips}>
        {(['current', 'list', 'ignored'] as const).map((key) => (
          <Chip
            key={key}
            label={key === 'current' ? t('sessions.current') : key === 'list' ? t('sessions.list') : `${t('sessions.ignoredList')} (${counts.ignored})`}
            selected={tab === key}
            onPress={() => setTab(key)}
          />
        ))}
      </View>

      {tab === 'current' ? (
        current ? (
          <>
            <ItemCard
              item={current}
              total={counts.total}
              canViewDetails={canViewBeneficiaries}
              onCall={canOperate ? (phone) => void call(current, phone) : undefined}
              onNote={canOperate ? () => setSheet('note') : undefined}
            />
            {canOperate && current.status === 'ignored' ? (
              <Button title={t('sessions.reopen')} variant="secondary" icon={<RotateCcw />} onPress={() => reopen(current)} />
            ) : null}
          </>
        ) : (
          <Card style={styles.finished}>
            <View style={[styles.finishedIcon, { backgroundColor: colors.accent }]}>
              <CircleCheckBig size={sizes.iconLg} color={colors.onAccent} strokeWidth={iconStroke} />
            </View>
            <AppText variant="h3" center>
              {t('sessions.allProcessed')}
            </AppText>
            {active ? (
              <AppText variant="bodySm" tone="secondary" center>
                {t('sessions.allProcessedHint')}
              </AppText>
            ) : null}
            {canOperate ? <Button title={t('sessions.end')} icon={<Flag />} onPress={() => setSheet('end')} /> : null}
            {canExport ? (
              <Button
                variant="secondary"
                title={t('sessions.exportReport')}
                icon={<FileDown />}
                onPress={() => router.push(`/export?preset=session&sessionId=${session.id}`)}
              />
            ) : null}
          </Card>
        )
      ) : (
        <>
          <SearchField placeholder={t('common.search')} value={search} onChangeText={setSearch} />
          {tab === 'list' ? (
            <View style={styles.chips}>
              {(['all', 'pending', 'checked', 'ignored'] as const).map((key) => (
                <Chip
                  key={key}
                  label={key === 'all' ? t('common.all') : t(`sessions.itemStatus.${key}`)}
                  selected={statusFilter === key}
                  onPress={() => setStatusFilter(key)}
                />
              ))}
            </View>
          ) : null}
          {filtered.length === 0 ? (
            <EmptyState icon={SearchX} title={t('beneficiaries.noResults')} />
          ) : (
            <GroupedList>
              {filtered.map((item) => (
                <ListRow
                  key={item.id}
                  label={item.fullName}
                  hint={`#${item.order + 1} · ${item.areaName}`}
                  chevron={false}
                  right={
                    canOperate && item.status === 'ignored' ? (
                      <Button compact fullWidth={false} variant="secondary" title={t('sessions.reopen')} onPress={() => reopen(item)} />
                    ) : (
                      <Badge
                        label={t(`sessions.itemStatus.${item.status}`)}
                        tone={item.status === 'checked' ? 'success' : item.status === 'ignored' ? 'warning' : 'neutral'}
                      />
                    )
                  }
                  onPress={() => {
                    setSelectedId(item.id);
                    setTab('current');
                  }}
                />
              ))}
            </GroupedList>
          )}
        </>
      )}

      <BottomSheet visible={sheet === 'menu'} title={t('sessions.actions')} onClose={() => setSheet(null)}>
        <GroupedList>
          {canExport ? (
            <ListRow
              icon={FileDown}
              label={t('sessions.exportReport')}
              onPress={() => {
                setSheet(null);
                router.push(`/export?preset=session&sessionId=${session.id}`);
              }}
            />
          ) : null}
          {active && canReassign ? <ListRow icon={UserCog} label={t('sessions.reassign')} onPress={() => setSheet('reassign')} /> : null}
          {canOperate ? <ListRow icon={Flag} label={t('sessions.end')} destructive onPress={() => setSheet('end')} /> : null}
        </GroupedList>
      </BottomSheet>

      <ConfirmDialog
        visible={sheet === 'end'}
        title={t('sessions.end')}
        message={t('sessions.endConfirm')}
        confirmLabel={t('sessions.end')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setSheet(null)}
        onConfirm={() => {
          endSession(ctx, items);
          emitActionFeedback({ message: t('sessions.ended'), kind: 'success' });
          setSheet(null);
        }}
      />

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

/** Big thumb-zone targets: Ignore (outlined, 1 part) and Check (lime, 2 parts). */
function ThumbAction({ kind, label, onPress }: { kind: 'check' | 'ignore'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const check = kind === 'check';
  const Icon = check ? Check : X;
  const fg = check ? colors.onAccent : colors.textPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        check ? styles.actionMain : null,
        {
          backgroundColor: check ? (pressed ? colors.accentPressed : colors.accent) : colors.surface,
          borderColor: check ? colors.accent : colors.border,
          transform: [{ scale: pressed ? motion.pressScale : 1 }],
        },
      ]}
    >
      <Icon size={sizes.iconLg} color={fg} strokeWidth={iconStroke + 0.75} />
      <AppText variant="h2" style={{ color: fg }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function NoteSheet({ visible, initial, onClose, onSave }: { visible: boolean; initial: string; onClose: () => void; onSave: (note: string) => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState(initial);
  return (
    <BottomSheet visible={visible} title={t('sessions.note')} onClose={onClose} footer={<Button title={t('common.save')} onPress={() => onSave(note)} />}>
      <Field label={t('sessions.note')} multiline value={note} onChangeText={setNote} maxLength={1000} />
    </BottomSheet>
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
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await reassignOperator(wid, session, target, actor);
      emitActionFeedback({ message: t('sessions.reassigned'), kind: 'success' });
      onClose();
    } catch (error) {
      emitActionFeedback({
        message: error instanceof OfflineError ? t('errors.offline') : errorMessage(error),
        kind: 'error',
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet
      visible={visible}
      title={t('sessions.reassign')}
      onClose={onClose}
      footer={<Button title={t('common.confirm')} disabled={!target || busy} loading={busy} onPress={confirm} />}
    >
      <Select
        label={t('sessions.reassignTo')}
        value={target}
        options={members.filter((m) => m.id !== session.operatorId).map((m) => ({ value: m.id, label: m.displayName }))}
        onChange={setTarget}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing[4] },
  progress: { paddingHorizontal: screenPadding, paddingBottom: spacing[3], gap: spacing[2] },
  progressHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  thumb: { flexDirection: 'row', gap: spacing[3] },
  action: {
    flex: 1,
    minHeight: sizes.thumbAction,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  actionMain: { flex: 2 },
  finished: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },
  finishedIcon: { width: sizes.avatarMd, height: sizes.avatarMd, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});
