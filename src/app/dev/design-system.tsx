import { Redirect } from 'expo-router';
import { Bell, Building2, Globe, Heart, Moon, Plus, Search, Settings, Shield, Users } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  Chip,
  ComingSoon,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Fab,
  GroupedList,
  Header,
  IconButton,
  InlineBanner,
  ListFooter,
  ListRow,
  NoPermissionState,
  PhoneField,
  ProgressBar,
  SearchBar,
  SectionHeader,
  SelectableCard,
  SelectField,
  SkeletonBanner,
  SkeletonCard,
  SkeletonList,
  SkeletonStatCard,
  StatCard,
  Switch,
  TextField,
  useToast,
} from '@/components/ui';
import { useTranslation } from '@/localization';
import { radii, screenPadding, spacing, ThemeProvider, typography, useTheme, type ThemeColors, type TypeVariant } from '@/theme';

/** Dev-only catalogue of every token and component, for the compliance pass (docs/design-system.md). */
export default function DesignSystemScreen() {
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [rtl, setRtl] = useState(true);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ThemeProvider override={scheme}>
      <Catalogue scheme={scheme} rtl={rtl} onScheme={setScheme} onRtl={setRtl} />
    </ThemeProvider>
  );
}

function Catalogue({
  scheme,
  rtl,
  onScheme,
  onRtl,
}: {
  scheme: 'light' | 'dark';
  rtl: boolean;
  onScheme: (value: 'light' | 'dark') => void;
  onRtl: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [chip, setChip] = useState<string | null>('a');
  const [toggle, setToggle] = useState(true);
  const [choice, setChoice] = useState<'personal' | 'team'>('team');
  const [select, setSelect] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [query, setQuery] = useState('');
  const swatches = Object.keys(colors).filter((k) => !LEGACY_KEYS.has(k)) as (keyof ThemeColors)[];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top, direction: rtl ? 'rtl' : 'ltr' }]}>
      <Header
        title={t('designSystem.title')}
        back
        tag="DEV"
        trailing={<IconButton icon={Bell} label="bell" dot onPress={() => undefined} />}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <GroupedList>
          <ListRow
            icon={Moon}
            label="Dark mode"
            right={<Switch label="Dark mode" value={scheme === 'dark'} onValueChange={(v) => onScheme(v ? 'dark' : 'light')} />}
          />
          <ListRow icon={Globe} label="RTL" right={<Switch label="RTL" value={rtl} onValueChange={onRtl} />} />
        </GroupedList>

        <SectionHeader title={t('designSystem.colors')} />
        <View style={styles.swatches}>
          {swatches.map((key) => (
            <View key={key} style={styles.swatch}>
              <View style={[styles.chipColor, { backgroundColor: colors[key], borderColor: colors.border }]} />
              <AppText variant="caption" muted numberOfLines={1} ltr>
                {key}
              </AppText>
            </View>
          ))}
        </View>

        <SectionHeader title={t('designSystem.type')} />
        <Card>
          {(Object.keys(typography) as TypeVariant[]).map((variant) => (
            <View key={variant} style={styles.typeRow}>
              <AppText variant="caption" muted ltr>
                {variant}
              </AppText>
              <AppText variant={variant}>{t('designSystem.sample')}</AppText>
              <AppText variant={variant}>{t('designSystem.sampleArabic')}</AppText>
            </View>
          ))}
        </Card>

        <SectionHeader title={t('designSystem.buttons')} />
        <View style={styles.stack}>
          <Button title="Primary" />
          <Button title="Secondary" variant="secondary" />
          <Button title="Lime" variant="lime" icon={<Plus />} />
          <Button title="Ghost" variant="ghost" />
          <Button title="Destructive" variant="destructive" />
          <Button title="Loading" loading loadingTitle="Saving..." />
          <Button title="Disabled" disabled />
          <View style={styles.row}>
            <Button title="Compact" compact fullWidth={false} />
            <IconButton icon={Settings} label="outline" />
            <IconButton icon={Search} label="filled" variant="filled" />
            <IconButton icon={Plus} label="ink" variant="ink" round />
            <IconButton icon={Heart} label="lime" variant="lime" round />
          </View>
        </View>

        <SectionHeader title={t('designSystem.inputs')} />
        <Card>
          <TextField label={t('designSystem.label')} placeholder={t('designSystem.placeholder')} />
          <TextField label={t('designSystem.label')} error={t('designSystem.error')} value="x" />
          <PhoneField label="Phone" prefix="+20" placeholder="10 1234 5678" />
          <SelectField
            label="Select"
            value={select}
            onChange={setSelect}
            placeholder={t('designSystem.placeholder')}
            options={[
              { value: 'a', label: 'Cairo' },
              { value: 'b', label: 'Giza', hint: 'Hint' },
            ]}
          />
          <SearchBar value={query} onChangeText={setQuery} placeholder={t('common.search')} />
        </Card>

        <SectionHeader title={t('designSystem.chips')} />
        <View style={[styles.row, styles.wrap]}>
          <Chip label="Selected" selected={chip === 'a'} onPress={() => setChip('a')} onClear={() => setChip(null)} />
          <Chip label="Outlined" selected={chip === 'b'} onPress={() => setChip('b')} onClear={() => setChip(null)} />
          <Chip label="Dropdown" dropdown />
          <Badge label="SUPER ADMIN" tone="lime" ltr />
          <Badge label="Ink" tone="ink" />
          <Badge label="Neutral" />
          <Badge label="Success" tone="success" />
          <Badge label="Warning" tone="warning" />
          <Badge label="Danger" tone="danger" />
          <Badge label="Info" tone="info" />
        </View>

        <SectionHeader title={t('designSystem.lists')} actionLabel="See all" onAction={() => undefined} />
        <GroupedList>
          <ListRow icon={Users} label="Members" value="12" onPress={() => undefined} />
          <ListRow icon={Building2} label="Workspace" hint="Secondary text" onPress={() => undefined} />
          <ListRow icon={Shield} tile="lime" label="Manage" onPress={() => undefined} />
          <ListRow icon={Bell} label="Notifications" right={<Switch label="n" value={toggle} onValueChange={setToggle} />} />
          <ListRow icon={Settings} label="Sign out" destructive onPress={() => undefined} />
        </GroupedList>
        <GroupedList variant="tiles">
          <ListRow label="Tile row one" onPress={() => undefined} />
          <ListRow label="Tile row two" onPress={() => undefined} />
        </GroupedList>

        <SectionHeader title={t('designSystem.cards')} />
        <View style={styles.row}>
          <StatCard value="1,240" label="Families helped" tone="lime" />
          <StatCard value="86" label="Volunteers" />
        </View>
        <SelectableCard title="Team" hint="Shared workspace" icon={Users} selected={choice === 'team'} onPress={() => setChoice('team')} />
        <SelectableCard title="Personal" icon={Heart} selected={choice === 'personal'} onPress={() => setChoice('personal')} />
        <Card>
          <View style={styles.row}>
            <Avatar name="Ahmed Salih" size={56} active />
            <Avatar name="سارة علي" size={56} onEdit={() => undefined} />
            <Avatar name="Mona" />
          </View>
        </Card>
        <Card tone="ink">
          <AppText variant="h3" tone="onPrimary">
            Ink card
          </AppText>
        </Card>

        <SectionHeader title={t('designSystem.states')} />
        <Card>
          <EmptyState title="Nothing here yet" hint="Add the first one." actionLabel="Add" onAction={() => undefined} />
        </Card>
        <Card>
          <ErrorState message="Check your connection and try again." onRetry={() => undefined} />
        </Card>
        <Card>
          <NoPermissionState />
        </Card>
        <Card>
          <ComingSoon />
        </Card>
        <Card>
          <ListFooter loadingMore={false} done onRetry={() => undefined} />
          <ListFooter loadingMore={false} done={false} error="x" onRetry={() => undefined} />
        </Card>

        <SectionHeader title={t('designSystem.skeletons')} />
        <View style={styles.stack}>
          <SkeletonBanner />
          <View style={styles.row}>
            <SkeletonStatCard />
            <SkeletonStatCard />
          </View>
          <SkeletonCard />
          <SkeletonList count={3} />
        </View>

        <SectionHeader title={t('designSystem.feedback')} />
        <InlineBanner tone="offline" message={t('states.offline')} />
        <InlineBanner tone="warning" message="Warning" actionLabel="Fix" onAction={() => undefined} />
        <InlineBanner tone="danger" message="Danger" />
        <ProgressBar value={0.6} label="Upload" />
        <View style={styles.stack}>
          <Button
            title={t('designSystem.toast')}
            variant="secondary"
            onPress={() =>
              showToast({
                kind: 'success',
                message: t('designSystem.toastMessage'),
                action: { label: t('designSystem.undo'), onPress: () => undefined },
              })
            }
          />
          <Button title={t('designSystem.sheet')} variant="secondary" onPress={() => setSheet(true)} />
          <Button title={t('designSystem.confirm')} variant="secondary" onPress={() => setConfirm(true)} />
        </View>
      </ScrollView>

      <Fab label="Add" icon={<Plus />} onPress={() => undefined} />
      <BottomSheet visible={sheet} title="Bottom sheet" onClose={() => setSheet(false)} footer={<Button title="Done" onPress={() => setSheet(false)} />}>
        <AppText muted>Drag handle, radius 28, dimmed backdrop.</AppText>
      </BottomSheet>
      <ConfirmDialog
        visible={confirm}
        title="Delete this?"
        message="This can't be undone."
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => setConfirm(false)}
        onCancel={() => setConfirm(false)}
      />
    </View>
  );
}

const LEGACY_KEYS = new Set([
  'text',
  'primarySoft',
  'accentSoft',
  'topBar',
  'surfaceRaised',
  'backgroundElement',
  'backgroundSelected',
  'dangerSoft',
  'warningSoft',
  'successSoft',
]);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: screenPadding, paddingBottom: 140, gap: spacing[3] },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  swatch: { width: 76, gap: spacing[1] },
  chipColor: { height: 44, borderRadius: radii.sm, borderWidth: StyleSheet.hairlineWidth },
  typeRow: { gap: 2, marginBottom: spacing[3] },
  stack: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  wrap: { flexWrap: 'wrap' },
});
