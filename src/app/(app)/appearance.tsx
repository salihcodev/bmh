import { Check, Monitor, Moon, Sun } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/layout/screen-header";
import {
  AppText,
  GroupedList,
  ListRow,
  Screen,
  SectionHeader,
} from "@/components/ui";
import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  useTranslation,
} from "@/localization";
import { usePreferences, type ThemePreference } from "@/store/preferences";
import { iconStroke, sizes, spacing, useTheme } from "@/theme";

const THEMES: { value: ThemePreference; key: string; icon: typeof Sun }[] = [
  { value: "system", key: "settings.themeSystem", icon: Monitor },
  { value: "light", key: "settings.themeLight", icon: Sun },
  { value: "dark", key: "settings.themeDark", icon: Moon },
];

/** Theme and language. Language changes may restart the app to flip layout direction. */
export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const theme = usePreferences((state) => state.theme);
  const language = usePreferences((state) => state.language);
  const setTheme = usePreferences((state) => state.setTheme);
  const setLanguage = usePreferences((state) => state.setLanguage);
  const check = (
    <Check
      size={sizes.icon}
      color={colors.textPrimary}
      strokeWidth={iconStroke}
    />
  );

  return (
    <Screen
      header={<ScreenHeader title={t("preferences.appearance")} back />}
      contentStyle={styles.content}
    >
      <View>
        <SectionHeader title={t("settings.theme")} />
        <GroupedList>
          {THEMES.map((option) => (
            <ListRow
              key={option.value}
              icon={option.icon}
              label={t(option.key)}
              chevron={false}
              right={theme === option.value ? check : undefined}
              onPress={() => setTheme(option.value)}
            />
          ))}
        </GroupedList>
      </View>
      <View>
        <SectionHeader title={t("settings.language")} />
        <GroupedList>
          {SUPPORTED_LANGUAGES.map((option) => (
            <ListRow
              key={option}
              label={LANGUAGE_NAMES[option]}
              chevron={false}
              right={language === option ? check : undefined}
              onPress={() => setLanguage(option)}
            />
          ))}
        </GroupedList>
        <AppText variant="caption" tone="secondary" style={styles.hint}>
          {t("settings.languageRestart")}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
  hint: { marginTop: spacing[2] },
});
