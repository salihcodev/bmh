import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { SUPPORTED_LANGUAGES, useTranslation, type Language } from '@/localization';
import { usePreferences, type ThemePreference } from '@/store/preferences';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_KEYS: Record<ThemePreference, string> = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
};
const LANGUAGE_NAMES: Record<Language, string> = { ar: 'العربية', en: 'English' };

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = usePreferences((state) => state.theme);
  const language = usePreferences((state) => state.language);
  const setTheme = usePreferences((state) => state.setTheme);
  const setLanguage = usePreferences((state) => state.setLanguage);

  return (
    <Screen header={<AppHeader title={t('settings.title')} back />}>
      <Card style={styles.section}>
        <AppText variant="heading">{t('settings.theme')}</AppText>
        <View style={styles.row}>
          {THEMES.map((option) => (
            <Button
              key={option}
              compact
              title={t(THEME_KEYS[option])}
              variant={theme === option ? 'primary' : 'secondary'}
              onPress={() => setTheme(option)}
            />
          ))}
        </View>
      </Card>
      <Card style={styles.section}>
        <AppText variant="heading">{t('settings.language')}</AppText>
        <AppText variant="caption" muted>
          {t('settings.languageRestart')}
        </AppText>
        <View style={styles.row}>
          {SUPPORTED_LANGUAGES.map((option) => (
            <Button
              key={option}
              compact
              title={LANGUAGE_NAMES[option]}
              variant={language === option ? 'primary' : 'secondary'}
              onPress={() => setLanguage(option)}
            />
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.lg, gap: Spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
