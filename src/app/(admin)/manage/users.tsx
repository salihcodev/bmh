import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Badge,
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ListFooter,
  Screen,
  SkeletonList,
  useDelayedLoading,
} from '@/components/ui';
import type { UserProfile } from '@/domain/user';
import { AdminHeader } from '@/features/admin/admin-header';
import { useAdminAction } from '@/features/admin/use-admin-action';
import { useTranslation } from '@/localization';
import { setUserStatus } from '@/services/admin/admin-writes';
import { useAdminUsers } from '@/services/admin/use-admin';
import { radii, screenPadding, sizes, spacing, useTheme } from '@/theme';

export default function ManageUsers() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ status?: string }>();
  const status = params.status === 'suspended' ? 'suspended' : 'all';
  const users = useAdminUsers(status);
  const { actor, run } = useAdminAction();
  const [target, setTarget] = useState<UserProfile | null>(null);
  const showSkeleton = useDelayedLoading(users.status === 'loading');

  const setFilter = (next: 'all' | 'suspended') => router.setParams({ status: next === 'suspended' ? 'suspended' : '' });
  const suspending = target?.status !== 'suspended';
  const name = (u: UserProfile) => u.displayName || u.email || t('manage.users.noName');

  return (
    <Screen
      scroll={false}
      header={<AdminHeader title={status === 'suspended' ? t('manage.users.suspendedTitle') : t('manage.users.title')} />}
    >
      <View style={styles.filters}>
        <Chip label={t('manage.users.title')} selected={status === 'all'} onPress={() => setFilter('all')} />
        <Chip label={t('manage.users.statusSuspended')} selected={status === 'suspended'} onPress={() => setFilter('suspended')} />
      </View>
      {users.status === 'loading' ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : users.status === 'error' ? (
        <ErrorState message={t('states.pageFailed')} onRetry={users.refresh} />
      ) : (
        <FlashList
          data={users.items ?? []}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          onEndReached={users.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={users.refreshing}
          onRefresh={users.refresh}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              name={name(item)}
              isSelf={item.id === actor.uid}
              onAction={item.globalRole === 'superadmin' || item.id === actor.uid ? undefined : () => setTarget(item)}
            />
          )}
          ListEmptyComponent={<EmptyState icon={Users} title={t('manage.users.empty')} />}
          ListFooterComponent={
            users.items?.length ? (
              <ListFooter
                loadingMore={users.loadingMore}
                error={users.moreError ? t('states.pageFailed') : null}
                done={users.done}
                onRetry={users.loadMore}
              />
            ) : null
          }
        />
      )}
      <ConfirmDialog
        visible={!!target}
        title={
          target
            ? t(suspending ? 'manage.users.suspendConfirmTitle' : 'manage.users.reactivateConfirmTitle', { name: name(target) })
            : ''
        }
        message={t(suspending ? 'manage.users.suspendConfirmBody' : 'manage.users.reactivateConfirmBody')}
        confirmLabel={t(suspending ? 'manage.users.suspend' : 'manage.users.reactivate')}
        cancelLabel={t('common.cancel')}
        destructive={suspending}
        onCancel={() => setTarget(null)}
        onConfirm={async () => {
          if (!target) return;
          const next = suspending ? 'suspended' : 'active';
          const ok = await run(
            (a) => setUserStatus(a, target.id, next),
            t(suspending ? 'manage.users.suspendedDone' : 'manage.users.reactivatedDone'),
          );
          if (ok) setTarget(null);
        }}
      />
    </Screen>
  );
}

function UserRow({
  user,
  name,
  isSelf,
  onAction,
}: {
  user: UserProfile;
  name: string;
  isSelf: boolean;
  onAction?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const suspended = user.status === 'suspended';
  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
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
          <Badge label={suspended ? t('manage.users.statusSuspended') : t('manage.users.statusActive')} tone={suspended ? 'danger' : 'success'} />
          {user.globalRole === 'superadmin' ? <Badge label={t('manage.users.roleSuperadmin')} tone="lime" /> : null}
          {isSelf ? <Badge label={t('manage.users.self')} tone="neutral" /> : null}
        </View>
      </View>
      {onAction ? (
        <Button
          compact
          fullWidth={false}
          variant={suspended ? 'secondary' : 'ghost'}
          title={suspended ? t('manage.users.reactivate') : t('manage.users.suspend')}
          onPress={onAction}
        />
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: screenPadding, paddingBottom: spacing[3] },
  pad: { paddingHorizontal: screenPadding },
  list: { paddingHorizontal: screenPadding, paddingBottom: spacing[10] },
  separator: { height: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radii.lg },
  body: { flex: 1, gap: spacing[1] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
});
