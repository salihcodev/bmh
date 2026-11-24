import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Button,
  Card,
  ErrorState,
  IconButton,
  Screen,
  SkeletonList,
  Switch,
} from '@/components/ui';
import {
  HOME_COUNT_MAX,
  moveHomeSection,
  patchHomeSection,
  type HomeSection,
  type HomeSectionKey,
} from '@/domain/home-config';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { saveHomeConfig } from '@/services/admin/admin-writes';
import { useHomeConfig } from '@/services/marketing/use-marketing';
import { spacing } from '@/theme';

export default function HomeConfigRoute() {
  const { can } = useCurrentUser();
  return (
    <PermissionGate allowed={can('home-config.manage')} fallback="/dashboard">
      <HomeConfigScreen />
    </PermissionGate>
  );
}

function HomeConfigScreen() {
  const { t } = useTranslation();
  const home = useHomeConfig();
  const { run } = useAdminAction();
  const [override, setOverride] = useState<HomeSection[] | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const draft = override ?? home.data;

  const ordered = useMemo(
    () => [...(draft ?? [])].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key)),
    [draft],
  );
  const fingerprint = JSON.stringify(ordered);
  const dirty = ordered.length > 0 && fingerprint !== (saved ?? JSON.stringify(home.data ?? []));

  const update = (next: HomeSection[]) => {
    setOverride([...next].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key)));
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const ok = await run((actor) => saveHomeConfig(actor, ordered), t('dashboard.homeSaved'));
    setSaving(false);
    if (ok) setSaved(fingerprint);
  };

  return (
    <Screen
      header={<ScreenHeader title={t('dashboard.homeTitle')} subtitle={t('dashboard.homeSubtitle')} back />}
      refreshing={home.status === 'loading'}
      onRefresh={home.retry}
      footer={
        <Button
          title={t('dashboard.homeSave')}
          onPress={save}
          loading={saving}
          disabled={!dirty || saving}
        />
      }
    >
      {home.status === 'error' && !draft ? (
        <ErrorState message={t('states.loadFailed')} onRetry={home.retry} />
      ) : !draft ? (
        <SkeletonList count={4} />
      ) : (
        <View style={styles.list}>
          {ordered.map((section, index) => (
            <SectionCard
              key={section.key}
              section={section}
              first={index === 0}
              last={index === ordered.length - 1}
              onVisible={(visible) => update(patchHomeSection(ordered, section.key, { visible }))}
              onCount={(count) => update(patchHomeSection(ordered, section.key, { count }))}
              onMove={(direction) => update(moveHomeSection(ordered, section.key, direction))}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function SectionCard({
  section,
  first,
  last,
  onVisible,
  onCount,
  onMove,
}: {
  section: HomeSection;
  first: boolean;
  last: boolean;
  onVisible: (visible: boolean) => void;
  onCount: (count: number) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const name = t(`marketingHome.sections.${section.key}`);
  const max = HOME_COUNT_MAX[section.key as HomeSectionKey];
  return (
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <AppText variant="body" weight="semibold">
            {name}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {section.visible ? t('dashboard.homeVisible') : t('dashboard.homeHidden')}
          </AppText>
        </View>
        <Switch value={section.visible} onValueChange={onVisible} label={name} />
      </View>
      <View style={styles.controls}>
        <IconButton
          icon={Minus}
          variant="ghost"
          label={t('dashboard.homeFewer')}
          disabled={section.count <= 1}
          onPress={() => onCount(section.count - 1)}
        />
        <AppText variant="body" weight="semibold" accessibilityLabel={t('dashboard.homeCount', { count: section.count })}>
          {String(section.count)}
        </AppText>
        <IconButton
          icon={Plus}
          variant="ghost"
          label={t('dashboard.homeMore')}
          disabled={section.count >= max}
          onPress={() => onCount(section.count + 1)}
        />
        <View style={styles.flex} />
        <IconButton
          icon={ChevronUp}
          variant="ghost"
          label={t('dashboard.homeMoveUp')}
          disabled={first}
          onPress={() => onMove(-1)}
        />
        <IconButton
          icon={ChevronDown}
          variant="ghost"
          label={t('dashboard.homeMoveDown')}
          disabled={last}
          onPress={() => onMove(1)}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  card: { gap: spacing[2] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  flex: { flex: 1 },
});
