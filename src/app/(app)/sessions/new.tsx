import { router } from 'expo-router';
import { useState } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Button, Card, Chip, EmptyState, Field, LoadingState, Row, Screen, Section, Select } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { evaluateCount, type CountCheck } from '@/domain/session';
import { SESSION_CONFIG } from '@/domain/session-config';
import type { Beneficiary } from '@/domain/types';
import { usePlaces } from '@/features/places/use-places';
import { useMyActiveSessions } from '@/features/sessions/use-sessions';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { fetchSessionCandidates, startSession } from '@/services/sessions/api';
import { OfflineError, useConnectivity } from '@/services/sync/connectivity';
import { formatDate } from '@/utils/format';

export default function NewSessionScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { wid, actor } = useActiveWorkspace();
  const canCreate = useCan('sessions_create');
  const isOnline = useConnectivity((state) => state.isOnline);
  const places = usePlaces(wid);
  const active = useMyActiveSessions(wid, actor.uid);
  const [name, setName] = useState(() => t('sessions.defaultName', { date: formatDate(new Date()) }));
  const [cityId, setCityId] = useState<string | null>(null);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [check, setCheck] = useState<{ result: CountCheck; candidates: Beneficiary[]; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cityAreas = cityId ? places.areasOf(cityId) : [];
  const selectionKey = `${cityId}|${[...areaIds].sort().join(',')}`;
  const current = check && check.key === selectionKey ? check : null;

  const describe = (exc: unknown) => (exc instanceof OfflineError ? t('sessions.needsConnection') : errorMessage(exc));

  const runCheck = async () => {
    setError(null);
    try {
      const candidates = await fetchSessionCandidates(wid, areaIds);
      setCheck({ result: evaluateCount(candidates.length), candidates, key: selectionKey });
    } catch (exc) {
      setError(describe(exc));
    }
  };

  const start = async () => {
    const city = cityId ? places.cityById.get(cityId) : undefined;
    if (!city || !current || current.result.state !== 'ok') return;
    setError(null);
    try {
      const areas = areaIds.map((id) => places.areaById.get(id)).filter((a) => !!a);
      const sid = await startSession(wid, { name: name.trim() || city.name, city, areas }, current.candidates, actor);
      emitActionFeedback({ message: t('sessions.started'), kind: 'success' });
      router.replace(`/(app)/sessions/${sid}`);
    } catch (exc) {
      setError(describe(exc));
    }
  };

  if (!canCreate) {
    return (
      <Screen header={<AppHeader title={t('sessions.setupTitle')} back />}>
        <EmptyState title={t('common.notAllowed')} />
      </Screen>
    );
  }

  return (
    <Screen header={<AppHeader title={t('sessions.setupTitle')} back />}>
      {!isOnline ? (
        <AppText style={{ color: colors.warning, marginBottom: Spacing.md }}>{t('sessions.needsConnection')}</AppText>
      ) : null}
      {active.length > 0 ? (
        <AppText style={{ color: colors.warning, marginBottom: Spacing.md }}>{t('sessions.activeWarning')}</AppText>
      ) : null}
      {places.loading ? (
        <LoadingState />
      ) : (
        <Card>
          <Field label={t('sessions.name')} value={name} onChangeText={setName} />
          <Select
            label={t('sessions.selectCity')}
            placeholder={t('cities.selectCity')}
            value={cityId}
            options={places.activeCities.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(value) => {
              setCityId(value);
              setAreaIds([]);
            }}
          />
          {cityId ? (
            <Section
              title={`${t('sessions.selectAreas')} (${t('sessions.areasSelected', { count: areaIds.length })})`}
              action={
                <Button
                  compact
                  variant="ghost"
                  title={areaIds.length === cityAreas.length ? t('common.deselectAll') : t('common.selectAll')}
                  onPress={() => setAreaIds(areaIds.length === cityAreas.length ? [] : cityAreas.map((a) => a.id))}
                />
              }
            >
              {cityAreas.length === 0 ? <AppText muted>{t('cities.noAreasInCity')}</AppText> : null}
              <Row wrap>
                {cityAreas.map((area) => (
                  <Chip
                    key={area.id}
                    label={`${area.name} (${area.beneficiaryCount ?? 0})`}
                    selected={areaIds.includes(area.id)}
                    onPress={() =>
                      setAreaIds((ids) => (ids.includes(area.id) ? ids.filter((id) => id !== area.id) : [...ids, area.id]))
                    }
                  />
                ))}
              </Row>
            </Section>
          ) : null}

          <AppText style={{ marginTop: Spacing.lg }} muted={!current}>
            {!current
              ? ' '
              : current.result.state === 'none'
                ? t('sessions.none')
                : current.result.state === 'tooMany'
                  ? t('sessions.tooMany', {
                      count: `${SESSION_CONFIG.maxBeneficiaries}+`,
                      max: SESSION_CONFIG.maxBeneficiaries,
                    })
                  : t('sessions.beneficiariesFound', { count: current.result.count })}
          </AppText>
          {error ? <AppText style={{ color: colors.danger, marginTop: Spacing.sm }}>{error}</AppText> : null}

          <Row wrap>
            <Button
              title={t('sessions.check')}
              loadingTitle={t('sessions.checking')}
              variant="secondary"
              disabled={areaIds.length === 0 || !isOnline}
              onPress={runCheck}
              style={{ marginTop: Spacing.md }}
            />
            <Button
              title={t('sessions.confirmStart')}
              loadingTitle={t('sessions.starting')}
              disabled={current?.result.state !== 'ok' || !isOnline}
              onPress={start}
              style={{ marginTop: Spacing.md }}
            />
          </Row>
        </Card>
      )}
    </Screen>
  );
}
