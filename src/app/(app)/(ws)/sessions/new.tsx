import { router } from 'expo-router';
import { Check, MapPinned } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Field,
  InlineBanner,
  LoadingState,
  NoPermissionState,
  ProgressBar,
  Screen,
  SectionHeader,
  Select,
} from '@/components/ui';
import { evaluateCount, type CountCheck } from '@/domain/session';
import { SESSION_CONFIG } from '@/domain/session-config';
import type { Area, Beneficiary } from '@/domain/types';
import { usePlaces } from '@/features/places/use-places';
import { useMyActiveSessions } from '@/features/sessions/use-sessions';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, usePermissions } from '@/providers/workspace-provider';
import { fetchSessionCandidates, startSession } from '@/services/sessions/api';
import { OfflineError, useConnectivity } from '@/services/sync/connectivity';
import { iconStroke, motion, radii, sizes, spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

type Step = 0 | 1 | 2;
const MAX = SESSION_CONFIG.maxBeneficiaries;

export default function NewSessionScreen() {
  const { t } = useTranslation();
  const { wid, actor } = useActiveWorkspace();
  const canCreate = usePermissions('sessions.create', 'sessions.start');
  const isOnline = useConnectivity((state) => state.isOnline);
  const places = usePlaces(wid);
  const active = useMyActiveSessions(wid, actor.uid);
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState(() => t('sessions.defaultName', { date: formatDate(new Date()) }));
  const [cityId, setCityId] = useState<string | null>(null);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [check, setCheck] = useState<{ result: CountCheck; candidates: Beneficiary[]; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cityAreas = cityId ? places.areasOf(cityId) : [];
  const selectionKey = `${cityId}|${[...areaIds].sort().join(',')}`;
  const current = check && check.key === selectionKey ? check : null;
  const estimate = cityAreas.filter((a) => areaIds.includes(a.id)).reduce((sum, a) => sum + (a.beneficiaryCount ?? 0), 0);
  const city = cityId ? places.cityById.get(cityId) : undefined;
  const header = <ScreenHeader title={t('sessions.setupTitle')} back />;

  const describe = (exc: unknown) => (exc instanceof OfflineError ? t('sessions.needsConnection') : errorMessage(exc));

  const runCheck = async () => {
    setError(null);
    setBusy(true);
    try {
      const candidates = await fetchSessionCandidates(wid, areaIds);
      setCheck({ result: evaluateCount(candidates.length), candidates, key: selectionKey });
    } catch (exc) {
      setError(describe(exc));
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!city || !current || current.result.state !== 'ok') return;
    setError(null);
    setBusy(true);
    try {
      const areas = areaIds.map((id) => places.areaById.get(id)).filter((a) => !!a);
      const sid = await startSession(wid, { name: name.trim() || city.name, city, areas }, current.candidates, actor);
      emitActionFeedback({ message: t('sessions.started'), kind: 'success' });
      router.replace(`/sessions/${sid}`);
    } catch (exc) {
      setError(describe(exc));
    } finally {
      setBusy(false);
    }
  };

  if (!canCreate || places.loading || places.activeCities.length === 0) {
    return (
      <Screen scroll={false} header={header}>
        {!canCreate ? (
          <NoPermissionState />
        ) : places.loading ? (
          <LoadingState />
        ) : (
          <EmptyState
            icon={MapPinned}
            title={t('cities.noCities')}
            actionLabel={t('home.manageAreas')}
            onAction={() => router.replace('/cities')}
          />
        )}
      </Screen>
    );
  }

  const steps = [t('sessions.stepDetails'), t('sessions.stepAreas'), t('sessions.stepReview')];
  const toggle = (id: string) => setAreaIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const footer = (
    <View style={styles.footer}>
      {step > 0 ? (
        <Button fullWidth={false} variant="secondary" title={t('sessions.back')} onPress={() => setStep((s) => (s - 1) as Step)} />
      ) : null}
      <View style={styles.flex}>
        {step === 0 ? (
          <Button title={t('sessions.next')} disabled={!cityId} onPress={() => setStep(1)} />
        ) : step === 1 ? (
          <Button title={t('sessions.next')} disabled={areaIds.length === 0} onPress={() => setStep(2)} />
        ) : current?.result.state === 'ok' ? (
          <Button
            variant="lime"
            title={t('sessions.confirmStart')}
            loading={busy}
            loadingTitle={t('sessions.starting')}
            disabled={!isOnline || busy}
            onPress={start}
          />
        ) : (
          <Button
            title={t('sessions.check')}
            loading={busy}
            loadingTitle={t('sessions.checking')}
            disabled={!isOnline || busy}
            onPress={runCheck}
          />
        )}
      </View>
    </View>
  );

  return (
    <Screen header={header} contentStyle={styles.content} footer={footer}>
      <Stepper steps={steps} current={step} />

      {!isOnline ? <InlineBanner tone="offline" message={t('sessions.needsConnection')} /> : null}
      {active.length > 0 ? <InlineBanner tone="warning" message={t('sessions.activeWarning')} /> : null}

      {step === 0 ? (
        <Card>
          <Field label={t('sessions.name')} value={name} onChangeText={setName} />
          <Select
            label={t('sessions.selectCity')}
            placeholder={t('cities.selectCity')}
            value={cityId}
            options={places.activeCities.map((c) => ({
              value: c.id,
              label: c.name,
              hint: t('sessions.areasSelected', { count: places.areasOf(c.id).length }),
            }))}
            onChange={(value) => {
              setCityId(value);
              setAreaIds([]);
            }}
          />
        </Card>
      ) : null}

      {step === 1 ? (
        <>
          <CapMeter value={estimate} />
          <SectionHeader
            title={`${t('sessions.selectAreas')} · ${t('sessions.areasSelected', { count: areaIds.length })}`}
            action={
              cityAreas.length > 0 ? (
                <Button
                  compact
                  fullWidth={false}
                  variant="ghost"
                  title={areaIds.length === cityAreas.length ? t('common.deselectAll') : t('common.selectAll')}
                  onPress={() => setAreaIds(areaIds.length === cityAreas.length ? [] : cityAreas.map((a) => a.id))}
                />
              ) : null
            }
          />
          {cityAreas.length === 0 ? (
            <EmptyState icon={MapPinned} title={t('cities.noAreasInCity')} />
          ) : (
            <View style={styles.areas}>
              {cityAreas.map((area) => (
                <AreaCard key={area.id} area={area} selected={areaIds.includes(area.id)} onPress={() => toggle(area.id)} />
              ))}
            </View>
          )}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Card style={styles.review}>
            <ReviewRow label={t('sessions.name')} value={name.trim() || city?.name || ''} />
            <ReviewRow label={t('sessions.city')} value={city?.name ?? ''} />
            <ReviewRow
              label={t('sessions.areas')}
              value={areaIds
                .map((id) => places.areaById.get(id)?.name)
                .filter(Boolean)
                .join('، ')}
            />
          </Card>
          {!current ? (
            <InlineBanner tone="info" message={t('sessions.reviewHint')} />
          ) : current.result.state === 'none' ? (
            <InlineBanner tone="warning" message={t('sessions.none')} />
          ) : current.result.state === 'tooMany' ? (
            <InlineBanner tone="danger" message={t('sessions.tooMany', { count: `${MAX}+`, max: MAX })} />
          ) : (
            <CapMeter value={current.result.count} exact />
          )}
        </>
      ) : null}

      {error ? <InlineBanner tone="danger" message={error} /> : null}
    </Screen>
  );
}

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepper} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: current + 1 }}>
      {steps.map((label, index) => {
        const done = index < current;
        const on = index === current;
        return (
          <View key={label} style={styles.step}>
            <View
              style={[
                styles.stepDot,
                { backgroundColor: on ? colors.primary : done ? colors.accent : colors.surface, borderColor: on ? colors.primary : done ? colors.accent : colors.border },
              ]}
            >
              {done ? (
                <Check size={sizes.iconSm} color={colors.onAccent} strokeWidth={iconStroke} />
              ) : (
                <AppText variant="caption" weight="bold" tone={on ? 'onPrimary' : 'secondary'} ltr>
                  {String(index + 1)}
                </AppText>
              )}
            </View>
            <AppText variant="caption" weight={on ? 'bold' : 'regular'} tone={on ? 'primary' : 'secondary'} numberOfLines={1}>
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

/** Selected beneficiaries against the per-session cap; turns danger above it. */
function CapMeter({ value, exact = false }: { value: number; exact?: boolean }) {
  const { t } = useTranslation();
  const over = value > MAX;
  return (
    <Card style={styles.meter}>
      <View style={styles.meterHead}>
        <AppText variant="h2" ltr tone={over ? 'danger' : 'primary'}>
          {`${value} / ${MAX}`}
        </AppText>
        <AppText variant="bodySm" tone="secondary" style={styles.flex}>
          {exact ? t('sessions.beneficiariesFound', { count: value }) : t('sessions.estimate', { n: value, max: MAX })}
        </AppText>
      </View>
      <ProgressBar value={value / MAX} label={t('sessions.estimate', { n: value, max: MAX })} />
      {over ? (
        <AppText variant="bodySm" tone="danger">
          {t('sessions.estimateOver', { max: MAX })}
        </AppText>
      ) : null}
    </Card>
  );
}

function AreaCard({ area, selected, onPress }: { area: Area; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const count = t('cities.beneficiaryCount', { count: area.beneficiaryCount ?? 0 });
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${area.name}, ${count}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.area,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.textPrimary : colors.border,
          transform: [{ scale: pressed ? motion.pressScale : 1 }],
        },
      ]}
    >
      <View style={[styles.check, { backgroundColor: selected ? colors.accent : colors.surfaceMuted }]}>
        {selected ? <Check size={sizes.iconSm} color={colors.onAccent} strokeWidth={iconStroke} /> : null}
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyLg" weight="semibold" numberOfLines={1}>
          {area.name}
        </AppText>
        <AppText variant="bodySm" tone="secondary">
          {count}
        </AppText>
      </View>
    </Pressable>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="bodyLg" weight="semibold">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  flex: { flex: 1 },
  footer: { flexDirection: 'row', gap: spacing[3] },
  stepper: { flexDirection: 'row', gap: spacing[2] },
  step: { flex: 1, alignItems: 'center', gap: spacing[1] },
  stepDot: {
    width: sizes.avatarSm,
    height: sizes.avatarSm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meter: { gap: spacing[2] },
  meterHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  areas: { gap: spacing[2] },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1.5,
  },
  check: { width: sizes.iconTile - spacing[2], height: sizes.iconTile - spacing[2], borderRadius: radii.xs, alignItems: 'center', justifyContent: 'center' },
  review: { gap: spacing[3] },
  reviewRow: { gap: spacing[1] / 2 },
});
