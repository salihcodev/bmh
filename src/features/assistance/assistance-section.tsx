import { limit, orderBy, query } from '@react-native-firebase/firestore';
import { onSnapshot } from '@/services/firebase/listeners';
import { CheckCircle2, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, BottomSheet, Button, Card, Chip, Field, InlineBanner, SectionHeader, Switch } from '@/components/ui';
import type { AssistanceRecord, AssistanceType, Beneficiary } from '@/domain/types';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { confirmAssistance, recordAssistance } from '@/services/assistance/api';
import { refs } from '@/services/firebase/refs';
import { normalizeDigits } from '@/utils/arabic';
import { spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

const TYPES: AssistanceType[] = ['food', 'cash', 'clothes', 'medical', 'other'];

function useAssistance(wid: string, bid: string, enabled: boolean) {
  const key = `${wid}:${bid}`;
  const [state, setState] = useState<{ key: string; records: AssistanceRecord[] | null; error: boolean }>({
    key: '',
    records: null,
    error: false,
  });
  useEffect(() => {
    if (!enabled || !wid || !bid) return;
    return onSnapshot(
      query(refs.assistance(wid, bid), orderBy('deliveredAt', 'desc'), limit(20)),
      (snapshot) => {
        const list: AssistanceRecord[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<AssistanceRecord, 'id'>) });
        });
        setState({ key, records: list, error: false });
      },
      () => setState({ key, records: [], error: true }),
    );
  }, [wid, bid, enabled, key]);
  return state.key === key ? state : { records: null, error: false };
}

/** YYYY-MM-DD (Arabic digits allowed), not in the future. */
export function parseDateInput(value: string, now = new Date()): Date | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalizeDigits(value).trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(match[2]) - 1) return null;
  return date.getTime() <= now.getTime() + 86400000 ? date : null;
}

function isoDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function AssistanceSection({ wid, beneficiary }: { wid: string; beneficiary: Beneficiary }) {
  const { t } = useTranslation();
  const { actor } = useActiveWorkspace();
  const canRecord = useCan('assistance_record');
  const canSee = useCan('beneficiaries_view');
  const { records, error } = useAssistance(wid, beneficiary.id, canSee);
  const [adding, setAdding] = useState(false);

  return (
    <View>
      <SectionHeader
        title={t('beneficiaries.assistance')}
        action={
          canRecord ? (
            <Button compact fullWidth={false} variant="ghost" title={t('assistance.add')} icon={<Plus />} onPress={() => setAdding(true)} />
          ) : null
        }
      />
      {error ? (
        <InlineBanner tone="danger" message={t('assistance.loadFailed')} />
      ) : (
        <Card>
          {records === null ? (
            <AppText variant="bodySm" tone="secondary">
              {t('common.loading')}
            </AppText>
          ) : records.length === 0 ? (
            <AppText variant="bodySm" tone="secondary">
              {t('beneficiaries.noAssistance')}
            </AppText>
          ) : null}
          {(records ?? []).map((record, index) => (
            <RecordRow
              key={record.id}
              record={record}
              first={index === 0}
              onConfirm={
                canRecord && record.confirmationStatus === 'unconfirmed'
                  ? () => {
                      confirmAssistance(wid, beneficiary, record, actor);
                      emitActionFeedback({ message: t('assistance.confirmedDone'), kind: 'success' });
                    }
                  : undefined
              }
            />
          ))}
        </Card>
      )}
      <AddAssistanceSheet
        key={adding ? 'open' : 'closed'}
        visible={adding}
        onClose={() => setAdding(false)}
        onSave={(input) => {
          recordAssistance(wid, beneficiary, input, actor);
          emitActionFeedback({ message: t('assistance.recorded'), kind: 'success' });
          setAdding(false);
        }}
      />
    </View>
  );
}

function RecordRow({ record, first, onConfirm }: { record: AssistanceRecord; first: boolean; onConfirm?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const confirmed = record.confirmationStatus === 'confirmed';
  return (
    <View style={[styles.row, !first && { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.flex}>
        <AppText variant="body" weight="semibold">
          {t(`assistance.types.${record.type}`)}
          {record.description ? ` · ${record.description}` : ''}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {[formatDate(record.deliveredAt?.toDate()), record.recordedByName].filter(Boolean).join(' · ')}
        </AppText>
        {record.notes ? (
          <AppText variant="caption" tone="secondary">
            {record.notes}
          </AppText>
        ) : null}
      </View>
      <Badge label={t(confirmed ? 'assistance.confirmed' : 'assistance.unconfirmed')} tone={confirmed ? 'success' : 'warning'} />
      {onConfirm ? (
        <Button compact fullWidth={false} variant="lime" title={t('assistance.confirm')} icon={<CheckCircle2 />} onPress={onConfirm} />
      ) : null}
    </View>
  );
}

function AddAssistanceSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (input: { type: AssistanceType; description?: string; deliveredAt: Date; notes?: string; confirmNow: boolean }) => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<AssistanceType>('food');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(isoDay(new Date()));
  const [notes, setNotes] = useState('');
  const [confirmNow, setConfirmNow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const deliveredAt = parseDateInput(date);
    if (!deliveredAt) {
      setError(t('validation.required'));
      return;
    }
    onSave({ type, description, deliveredAt, notes, confirmNow });
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('assistance.add')}
      onClose={onClose}
      footer={<Button title={t('common.save')} onPress={save} />}
    >
      <AppText variant="label">{t('assistance.type')}</AppText>
      <View style={styles.chips}>
        {TYPES.map((option) => (
          <Chip key={option} label={t(`assistance.types.${option}`)} selected={type === option} onPress={() => setType(option)} />
        ))}
      </View>
      <Field label={t('assistance.description')} value={description} onChangeText={setDescription} />
      <Field
        label={t('assistance.deliveredAt')}
        hint={t('assistance.dateHint')}
        ltr
        keyboardType="numbers-and-punctuation"
        value={date}
        onChangeText={setDate}
        error={error ?? undefined}
      />
      <Field label={t('assistance.notes')} multiline value={notes} onChangeText={setNotes} />
      <View style={styles.switchRow}>
        <AppText variant="body" style={styles.flex}>
          {t('assistance.confirmNow')}
        </AppText>
        <Switch label={t('assistance.confirmNow')} value={confirmNow} onValueChange={setConfirmNow} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 56 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[3] },
});
