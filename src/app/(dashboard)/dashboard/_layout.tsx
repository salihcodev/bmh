import { Stack } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Header, InlineBanner, Screen } from '@/components/ui';
import { DashboardLinks, DASHBOARD_WIDE } from '@/features/dashboard/links';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { useTranslation } from '@/localization';
import { useConnectivity } from '@/services/sync/connectivity';
import { useTheme } from '@/theme';

export default function DashboardLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= DASHBOARD_WIDE;
  const options = useStackScreenOptions();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const online = useConnectivity((state) => state.isOnline);

  return (
    <View style={styles.root}>
      {wide ? (
        <View style={[styles.side, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Screen scroll header={<Header title={t('dashboard.title')} />}>
            <DashboardLinks compact />
          </Screen>
        </View>
      ) : null}
      <View style={styles.main}>
        {online ? null : <InlineBanner tone="offline" message={t('manage.offline')} />}
        <Stack screenOptions={options} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  side: { width: 300, borderEndWidth: StyleSheet.hairlineWidth },
  main: { flex: 1 },
});
