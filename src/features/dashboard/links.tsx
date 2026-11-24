import { router, usePathname, type Href } from 'expo-router';
import {
  Building2,
  House,
  ClipboardList,
  Image as ImageIcon,
  KeyRound,
  Layers,
  LayoutTemplate,
  MessageSquare,
  MessageSquareText,
  Newspaper,
  Package,
  RefreshCw,
  ScrollText,
  Settings2,
  Shield,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { GroupedList, ListRow, SectionHeader } from '@/components/ui';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import type { SystemPermission } from '@/services/permissions/catalog';
import { spacing } from '@/theme';

export type DashSection = 'people' | 'access' | 'workspaces' | 'content' | 'store' | 'reports';

type Link = {
  key: string;
  section: DashSection;
  href: Href;
  icon: LucideIcon;
  perm: SystemPermission;
  orPerm?: SystemPermission | SystemPermission[];
};

const LINKS: Link[] = [
  { key: 'users', section: 'people', href: '/dashboard/users', icon: Users, perm: 'users.view' },
  { key: 'suppliers', section: 'people', href: '/manage/suppliers', icon: Store, perm: 'suppliers.view', orPerm: 'suppliers.approve' },
  { key: 'roles', section: 'access', href: '/dashboard/roles', icon: Shield, perm: 'roles.view' },
  { key: 'permissions', section: 'access', href: '/dashboard/permissions', icon: KeyRound, perm: 'permissions.view' },
  { key: 'presets', section: 'access', href: '/dashboard/presets', icon: Layers, perm: 'presets.view' },
  { key: 'workspaces', section: 'workspaces', href: '/dashboard/workspaces', icon: Building2, perm: 'workspaces.view' },
  { key: 'records', section: 'workspaces', href: '/dashboard/records', icon: ClipboardList, perm: 'workspaces.view' },
  { key: 'home', section: 'content', href: '/dashboard/home', icon: House, perm: 'home-config.manage' },
  { key: 'banners', section: 'content', href: '/manage/banners', icon: LayoutTemplate, perm: 'banners.view' },
  { key: 'news', section: 'content', href: '/manage/news', icon: Newspaper, perm: 'news.view' },
  { key: 'messages', section: 'content', href: '/manage/messages', icon: MessageSquareText, perm: 'messages.view', orPerm: ['alerts.view', 'info-texts.view'] },
  { key: 'cards', section: 'content', href: '/manage/soon/cards', icon: Sparkles, perm: 'home-config.manage' },
  { key: 'media', section: 'content', href: '/manage/media', icon: ImageIcon, perm: 'media.view' },
  { key: 'support', section: 'content', href: '/manage/support-methods', icon: Wallet, perm: 'support-methods.view' },
  { key: 'config', section: 'content', href: '/manage/soon/config', icon: Settings2, perm: 'app-settings.manage' },
  { key: 'audit', section: 'reports', href: '/manage/audit', icon: ScrollText, perm: 'logs.view' },
  { key: 'sync', section: 'reports', href: '/dashboard/sync', icon: RefreshCw, perm: 'sync-queue.view' },
  { key: 'feedback', section: 'reports', href: '/manage/soon/feedback', icon: MessageSquare, perm: 'reports.view' },
  { key: 'storeConfig', section: 'store', href: '/dashboard/store', icon: Store, perm: 'store-items.view' },
  { key: 'storeCategories', section: 'store', href: '/dashboard/store/categories', icon: Layers, perm: 'store-categories.edit' },
  { key: 'storeItems', section: 'store', href: '/dashboard/store/items', icon: Package, perm: 'store-items.view' },
  { key: 'allSuppliers', section: 'store', href: '/dashboard/suppliers', icon: Store, perm: 'suppliers.view', orPerm: 'suppliers.approve' },
  { key: 'allBags', section: 'store', href: '/dashboard/bags', icon: ShoppingBag, perm: 'bags.view' },
];

const SECTIONS: DashSection[] = ['people', 'access', 'workspaces', 'content', 'store', 'reports'];

export function DashboardLinks({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { can } = useCurrentUser();
  const pathname = usePathname();
  const visible = LINKS.filter((link) => can(link.perm) || [link.orPerm ?? []].flat().some((perm) => can(perm)));

  return (
    <View style={compact ? styles.compact : styles.page}>
      {SECTIONS.map((section) => {
        const rows = visible.filter((link) => link.section === section);
        if (rows.length === 0) return null;
        return (
          <View key={section}>
            <SectionHeader title={t(`dashboard.sections.${section}`)} />
            <GroupedList>
              {rows.map((link) => {
                const path = String(link.href);
                const active = pathname === path || pathname.startsWith(`${path}/`);
                return (
                  <ListRow
                    key={link.key}
                    icon={link.icon}
                    label={t(`dashboard.links.${link.key}`)}
                    hint={compact ? undefined : t(`dashboard.links.${link.key}Hint`)}
                    chevron={!compact}
                    onPress={() => router.push(link.href)}
                    accessibilityLabel={active ? `${t(`dashboard.links.${link.key}`)}, ${t('dashboard.current')}` : undefined}
                  />
                );
              })}
            </GroupedList>
          </View>
        );
      })}
    </View>
  );
}

export const DASHBOARD_WIDE = 840;

const styles = StyleSheet.create({
  page: { gap: spacing[6] },
  compact: { gap: spacing[4] },
});
