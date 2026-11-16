import { Tabs } from 'expo-router';
import { ClipboardList, Home, Menu, Users } from 'lucide-react-native';

import { Fonts } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 60 },
        tabBarLabelStyle: { fontFamily: Fonts.medium, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.home'), tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="beneficiaries"
        options={{
          title: t('tabs.beneficiaries'),
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: t('tabs.sessions'),
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: t('tabs.more'), tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }}
      />
    </Tabs>
  );
}
