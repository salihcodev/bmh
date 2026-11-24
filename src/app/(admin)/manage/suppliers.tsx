import { FlashList } from "@shopify/flash-list";
import { Store } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppText,
  Avatar,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ListFooter,
  PromptSheet,
  Screen,
  SkeletonList,
  useDelayedLoading,
} from "@/components/ui";
import type { SupplierRequest } from "@/domain/supplier";
import { AdminHeader } from "@/features/admin/admin-header";
import { useAdminAction } from "@/features/admin/use-admin-action";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTranslation } from "@/localization";
import { reviewSupplierRequest } from "@/services/admin/admin-writes";
import { useSupplierRequests } from "@/services/admin/use-admin";
import { radii, screenPadding, sizes, spacing, useTheme } from "@/theme";
import { formatDateTime } from "@/utils/format";

export default function ManageSuppliers() {
  const { t } = useTranslation();
  const requests = useSupplierRequests();
  const { run } = useAdminAction();
  const { can } = useCurrentUser();
  const canReview = can("suppliers.approve");
  const [approving, setApproving] = useState<SupplierRequest | null>(null);
  const [rejecting, setRejecting] = useState<SupplierRequest | null>(null);
  const showSkeleton = useDelayedLoading(requests.status === "loading");
  const name = (r: SupplierRequest) =>
    r.displayName || r.email || t("manage.users.noName");

  return (
    <Screen
      scroll={false}
      header={<AdminHeader title={t("manage.suppliers.title")} />}
    >
      {requests.status === "loading" ? (
        showSkeleton ? (
          <View style={styles.pad}>
            <SkeletonList />
          </View>
        ) : null
      ) : requests.status === "error" ? (
        <ErrorState message={t("states.pageFailed")} onRetry={requests.refresh} />
      ) : (
        <FlashList
          data={requests.items ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          onEndReached={requests.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={requests.refreshing}
          onRefresh={requests.refresh}
          renderItem={({ item }) => (
            <RequestRow
              request={item}
              name={name(item)}
              onApprove={canReview ? () => setApproving(item) : undefined}
              onReject={canReview ? () => setRejecting(item) : undefined}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={Store}
              title={t("manage.suppliers.empty")}
              hint={t("manage.suppliers.emptyHint")}
            />
          }
          ListFooterComponent={
            requests.items?.length ? (
              <ListFooter
                loadingMore={requests.loadingMore}
                error={requests.moreError ? t("states.pageFailed") : null}
                done={requests.done}
                onRetry={requests.loadMore}
              />
            ) : null
          }
        />
      )}
      <ConfirmDialog
        visible={approving !== null}
        title={t("manage.suppliers.approveTitle")}
        message={
          approving
            ? t("manage.suppliers.approveConfirm", { name: name(approving) })
            : ""
        }
        confirmLabel={t("manage.suppliers.approve")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setApproving(null)}
        onConfirm={async () => {
          const request = approving;
          setApproving(null);
          if (request)
            await run(
              (actor) =>
                reviewSupplierRequest(actor, request.id, "approved", undefined, {
                  displayName: request.displayName || request.email,
                }),
              t("manage.suppliers.approved"),
            );
        }}
      />
      <PromptSheet
        key={rejecting?.id ?? "closed"}
        visible={rejecting !== null}
        title={t("manage.suppliers.rejectTitle")}
        fields={[
          {
            key: "reason",
            label: t("manage.suppliers.reasonLabel"),
            initial: "",
            max: 1000,
          },
        ]}
        onClose={() => setRejecting(null)}
        onSubmit={async ({ reason = "" }) => {
          const request = rejecting;
          if (!request) return;
          const ok = await run(
            (actor) => reviewSupplierRequest(actor, request.id, "rejected", reason),
            t("manage.suppliers.rejected"),
          );
          if (ok) setRejecting(null);
        }}
      />
    </Screen>
  );
}

function Separator() {
  return <View style={{ height: spacing[2] }} />;
}

function RequestRow({
  request,
  name,
  onApprove,
  onReject,
}: {
  request: SupplierRequest;
  name: string;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.head}>
        <Avatar name={name} size={sizes.avatarSm} />
        <View style={styles.body}>
          <AppText variant="body" weight="semibold" numberOfLines={1}>
            {name}
          </AppText>
          {request.email ? (
            <AppText variant="caption" tone="secondary" ltr numberOfLines={1}>
              {request.email}
            </AppText>
          ) : null}
          {request.createdAt ? (
            <AppText variant="caption" tone="secondary">
              {formatDateTime(new Date(request.createdAt))}
            </AppText>
          ) : null}
        </View>
      </View>
      <AppText variant="bodySm" tone={request.message ? "primary" : "secondary"}>
        {request.message || t("manage.suppliers.noMessage")}
      </AppText>
      {onApprove && onReject ? (
        <View style={styles.actions}>
          <Button compact fullWidth={false} variant="ghost" title={t("manage.suppliers.reject")} onPress={onReject} />
          <Button compact fullWidth={false} title={t("manage.suppliers.approve")} onPress={onApprove} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: screenPadding },
  list: { padding: screenPadding },
  row: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[3],
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  body: { flex: 1, gap: spacing[1] },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing[2] },
});
