import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ListChecks, Plus, Users, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterButton,
  FilterGroup,
  IconButton,
  ListFooter,
  Screen,
  SearchBar,
  SkeletonList,
  useDelayedLoading,
} from '@/components/ui';
import {
  userMatchesBrowse,
  userQueryMode,
  type UserBrowse,
  type UserStatusFilter,
  type UserTypeFilter,
} from '@/domain/dashboard';
import { isSystemUserType, type UserProfile } from '@/domain/user';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { deleteUser, setUserStatus } from '@/services/admin/admin-writes';
import { useDashboardUsers } from '@/services/admin/use-admin';
import { isOwnerUser } from '@/services/permissions/can';
import { radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

const TYPES: UserTypeFilter[] = ['all', 'system', 'platform', 'owner', 'support', 'moderator', 'custom', 'member', 'supplier'];
const STATUSES: UserStatusFilter[] = ['any', 'active', 'suspended'];

export default function DashboardUsers() {
  const { can } = useCurrentUser();
  return (
    <PermissionGate allowed={can('users.view')} fallback="/dashboard">
      <UsersScreen />
    </PermissionGate>
  );
}

function UsersScreen() {
  const { t } = useTranslation();
  const { can, user } = useCurrentUser();
  const { run } = useAdminAction();
  const params = useLocalSearchParams<{ status?: string }>();
  const [browse, setBrowse] = useState<UserBrowse>({
    type: 'all',
    status: params.status === 'suspended' ? 'suspended' : 'any',
    search: '',
    showDeleted: false,
  });
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [bulk, setBulk] = useState<'suspend' | 'delete' | null>(null);
  const mode = useMemo(() => userQueryMode(browse), [browse]);
  const page = useDashboardUsers(mode);
  const showSkeleton = useDelayedLoading(page.status === 'loading');
  const canSuspend = can('users.suspend');
  const canDelete = can('users.delete');
  const canCreate = can('users.create');
  const rows = (page.items ?? []).filter((item) => userMatchesBrowse(item, browse));

  const toggle = (id: string) =>
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.length >= 30 ? current : [...current, id]));

  const actionable = (item: UserProfile) => !isOwnerUser(item) && item.id !== user?.uid && !item.isDeleted;

  return (
    <Screen
      scroll={false}
      header={
        <ScreenHeader
          title={t('dashboard.usersTitle')}
          subtitle={t('dashboard.usersSubtitle')}
          back
          actions={
            canSuspend || canDelete ? (
              <IconButton
                icon={selecting ? X : ListChecks}
                variant={selecting ? 'ink' : 'outline'}
                label={selecting ? t('dashboard.doneSelecting') : t('dashboard.select')}
                onPress={() => {
                  setSelecting((value) => !value);
                  setPicked([]);
                }}
              />
            ) : undefined
          }
        />
      }
      footer={
        selecting && picked.length > 0 ? (
          <View style={styles.bulk}>
            {canSuspend ? (
              <Button title={t('dashboard.bulkSuspend', { count: picked.length })} variant="secondary" onPress={() => setBulk('suspend')} />
            ) : null}
            {canDelete ? (
              <Button title={t('dashboard.bulkDelete', { count: picked.length })} variant="danger" onPress={() => setBulk('delete')} />
            ) : null}
          </View>
        ) : canCreate ? (
          <Button title={t('dashboard.createUser')} icon={<Plus />} onPress={() => router.push('/dashboard/users/new')} />
        ) : undefined
      }
    >
      <View style={styles.tools}>
        <View style={styles.flex}>
          <SearchBar
            value={browse.search}
            onChangeText={(search) => setBrowse((current) => ({ ...current, search }))}
            placeholder={t('dashboard.userSearch')}
          />
        </View>
        <FilterButton activeCount={(browse.type === 'all' ? 0 : 1) + (browse.status === 'any' ? 0 : 1) + (browse.showDeleted ? 1 : 0)} onReset={() => setBrowse((current) => ({ ...current, type: 'all', status: 'any', showDeleted: false }))}>
          <FilterGroup label={t('dashboard.filterType')}>
            {TYPES.map((type) => (
              <Chip key={type} label={t(`dashboard.userFilter.${type}`)} selected={browse.type === type} onPress={() => setBrowse((current) => ({ ...current, type }))} />
            ))}
          </FilterGroup>
          <FilterGroup label={t('dashboard.filterStatus')}>
            {STATUSES.map((status) => (
              <Chip key={status} label={t(`dashboard.statusFilter.${status}`)} selected={browse.status === status} onPress={() => setBrowse((current) => ({ ...current, status }))} />
            ))}
            <Chip label={t('dashboard.showDeleted')} selected={browse.showDeleted} onPress={() => setBrowse((current) => ({ ...current, showDeleted: !current.showDeleted }))} />
          </FilterGroup>
        </FilterButton>
      </View>
      {page.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : page.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={page.refresh} />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          onEndReached={page.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={page.refreshing}
          onRefresh={page.refresh}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              selected={picked.includes(item.id)}
              selecting={selecting && actionable(item)}
              onPress={() => (selecting && actionable(item) ? toggle(item.id) : router.push(`/dashboard/users/${item.id}`))}
            />
          )}
          ListEmptyComponent={<EmptyState icon={Users} title={t('manage.users.empty')} />}
          ListFooterComponent={
            page.items?.length ? (
              <ListFooter loadingMore={page.loadingMore} error={page.moreError ? t('states.pageFailed') : null} done={page.done} onRetry={page.loadMore} />
            ) : null
          }
        />
      )}
      <ConfirmDialog
        visible={!!bulk}
        title={t(bulk === 'delete' ? 'dashboard.bulkDeleteTitle' : 'dashboard.bulkSuspendTitle', { count: picked.length })}
        message={t(bulk === 'delete' ? 'dashboard.bulkDeleteBody' : 'dashboard.bulkSuspendBody')}
        confirmLabel={t(bulk === 'delete' ? 'dashboard.deleteUser' : 'manage.users.suspend')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setBulk(null)}
        onConfirm={async () => {
          const action = bulk;
          const ids = picked;
          setBulk(null);
          if (!action) return;
          let failed = false;
          for (const id of ids) {
            const known = (page.items ?? []).find((item) => item.id === id);
            const label = known?.displayName || known?.email;
            const ok = await run((a) => (action === 'delete' ? deleteUser(a, id, label) : setUserStatus(a, id, 'suspended', label)));
            if (!ok) {
              failed = true;
              break;
            }
          }
          if (!failed) {
            setPicked([]);
            setSelecting(false);
          }
        }}
      />
    </Screen>
  );
}

function UserRow({
  user,
  selected,
  selecting,
  onPress,
}: {
  user: UserProfile;
  selected: boolean;
  selecting: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const name = user.displayName || user.email || t('manage.users.noName');
  return (
    <Pressable
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={{ checked: selecting ? selected : undefined }}
      onPress={onPress}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.surface }]}
    >
      <Avatar name={name} size={sizes.avatarSm} />
      <View style={styles.body}>
        <AppText variant="body" weight="semibold" numberOfLines={1}>
          {name}
        </AppText>
        {user.email ? (
          <AppText variant="caption" tone="secondary" ltr numberOfLines={1}>
            {user.email}
          </AppText>
        ) : null}
        <View style={styles.tags}>
          <Badge label={t(`dashboard.userFilter.${user.userType}`)} tone={isSystemUserType(user.userType) ? 'lime' : 'neutral'} />
          <Badge
            label={user.isDeleted ? t('dashboard.deleted') : user.status === 'suspended' ? t('manage.users.statusSuspended') : t('manage.users.statusActive')}
            tone={user.isDeleted || user.status === 'suspended' ? 'danger' : 'success'}
          />
        </View>
      </View>
      {selecting ? (
        <View style={[styles.mark, { backgroundColor: selected ? colors.primary : colors.surfaceMuted }]}>
          {selected ? <Check size={sizes.iconSm} color={colors.onPrimary} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  tools: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: screenPadding, paddingBottom: spacing[3] },
  flex: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: spacing[10] },
  separator: { height: spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: spacing[1] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  bulk: { gap: spacing[2] },
  mark: { width: sizes.minTouch, height: sizes.minTouch, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});
