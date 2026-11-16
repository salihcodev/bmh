import { limit, onSnapshot, orderBy, query } from '@react-native-firebase/firestore';
import { CheckCircle2, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText, Badge, Button, Card, Chip, Field, Row, Section, Sheet } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { AssistanceRecord, AssistanceType, Beneficiary } from '@/domain/types';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { confirmAssistance, recordAssistance } from '@/services/assistance/api';
import { refs } from '@/services/firebase/refs';
import { normalizeDigits } from '@/utils/arabic';
import { formatDate } from '@/utils/format';

const TYPES: AssistanceType[] = ['food', 'cash', 'clothes', 'medical', 'other'];

function useAssistance(wid: string, bid: string, enabled: boolean) {
  const [records, setRecords] = useState<AssistanceRecord[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(refs.assistance(wid, bid), orderBy('deliveredAt', 'desc'), limit(20)),
      (snapshot) => {
        const list: AssistanceRecord[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<AssistanceRecord, 'id'>) });
        });
        setRecords(list);
      },
      () => setRecords([]),
    );
  }, [wid, bid, enabled]);
  return records;
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
  const records = useAssistance(wid, beneficiary.id, canSee);
  const [adding, setAdding] = useState(false);

  return (
    <Section
      title={t('beneficiaries.assistance')}
      action={
        canRecord ? (
          <Button compact variant="ghost" title={t('assistance.add')} icon={<Plus size={16} />} onPress={() => setAdding(true)} />
        ) : null
      }
    >
      <Card>
        {records.length === 0 ? <AppText muted>{t('beneficiaries.noAssistance')}</AppText> : null}
        {records.map((record) => (
          <RecordRow
            key={record.id}
            record={record}
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
    </Section>
  );
}

function RecordRow({ record, onConfirm }: { record: AssistanceRecord; onConfirm?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const confirmed = record.confirmationStatus === 'confirmed';
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.flex}>
        <AppText variant="label">
          {t(`assistance.types.${record.type}`)}
          {record.description ? ` · ${record.description}` : ''}
        </AppText>
        <AppText variant="caption" muted>
          {[formatDate(record.deliveredAt?.toDate()), record.recordedByName].filter(Boolean).join(' · ')}
        </AppText>
        {record.notes ? (
          <AppText variant="caption" muted>
            {record.notes}
          </AppText>
        ) : null}
      </View>
      <Badge label={t(confirmed ? 'assistance.confirmed' : 'assistance.unconfirmed')} tone={confirmed ? 'success' : 'warning'} />
      {onConfirm ? (
        <Button compact variant="secondary" title={t('assistance.confirm')} icon={<CheckCircle2 size={16} />} onPress={onConfirm} />
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
  const { colors } = useAppTheme();
  const [type, setType] = useState<AssistanceType>('food');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(isoDay(new Date()));
  const [notes, setNotes] = useState('');
  const [confirmNow, setConfirmNow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet visible={visible} title={t('assistance.add')} onClose={onClose}>
      <AppText variant="label">{t('assistance.type')}</AppText>
      <Row wrap>
        {TYPES.map((option) => (
          <Chip key={option} label={t(`assistance.types.${option}`)} selected={type === option} onPress={() => setType(option)} />
        ))}
      </Row>
      <Field label={t('assistance.description')} value={description} onChangeText={setDescription} />
      <Field
        label={t('assistance.deliveredAt')}
        hint="YYYY-MM-DD"
        ltr
        keyboardType="numbers-and-punctuation"
        value={date}
        onChangeText={setDate}
        error={error ?? undefined}
      />
      <Field label={t('assistance.notes')} multiline value={notes} onChangeText={setNotes} />
      <Row>
        <AppText style={styles.flex}>{t('assistance.confirmNow')}</AppText>
        <Switch value={confirmNow} onValueChange={setConfirmNow} trackColor={{ true: colors.primary, false: colors.border }} />
      </Row>
      <Button
        title={t('common.save')}
        onPress={() => {
          const deliveredAt = parseDateInput(date);
          if (!deliveredAt) {
            setError(t('validation.required'));
            return;
          }
          onSave({ type, description, deliveredAt, notes, confirmNow });
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
