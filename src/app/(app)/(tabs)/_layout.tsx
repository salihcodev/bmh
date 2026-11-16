import { Tabs } from 'expo-router';
import { ClipboardList, House, LayoutGrid, Settings } from 'lucide-react-native';

import { Avatar, TabBar } from '@/components/ui';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { iconStroke, sizes } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { profile, user } = useAuth();
  const name = profile?.displayName || user?.displayName || user?.email || '?';
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={iconStroke} />,
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: t('tabs.activities'),
          tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} strokeWidth={iconStroke} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: t('tabs.sessions'),
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} strokeWidth={iconStroke} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={iconStroke} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <Avatar name={name} size={sizes.iconLg + 8} active={focused} />,
        }}
      />
    </Tabs>
  );
}
