import { router, useLocalSearchParams } from "expo-router";
import { Crown, ShieldCheck, UserMinus, UserX } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/layout/screen-header";
import {
  AppText,
  Avatar,
  Badge,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  GroupedList,
  InlineBanner,
  ListRow,
  LoadingState,
  Screen,
  SectionHeader,
  Switch,
} from "@/components/ui";
import type { Member } from "@/domain/types";
import { isCreatorSeat, roleLabel, useWorkspaceRoles } from "@/features/members/roles";
import { useMemberList } from "@/features/members/use-members";
import { emitActionFeedback, errorMessage } from "@/lib/action-feedback";
import { useTranslation } from "@/localization";
import {
  useActiveWorkspace,
  usePermission,
  useWorkspaceKeys,
} from "@/providers/workspace-provider";
import { canGrant, isWorkspaceAdmin } from "@/services/permissions/can";
import { assignableKeys, WORKSPACE_ADMIN_ROLE } from "@/services/permissions/catalog";
import { OfflineError } from "@/services/sync/connectivity";
import {
  removeMember,
  setMemberRole,
  setMemberStatus,
  transferOwnership,
} from "@/services/workspaces/api";
import { sizes, spacing } from "@/theme";

const WORKSPACE_KEYS = assignableKeys("workspace");

export default function MemberScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { wid } = useActiveWorkspace();
  const { members, error, retry } = useMemberList(wid);
  const target = members?.find((m) => m.id === memberId);
  const { t } = useTranslation();

  if (!target) {
    return (
      <Screen
        scroll={false}
        header={<ScreenHeader title={t("members.title")} back />}
      >
        {error ? (
          <ErrorState message={t("states.loadFailed")} onRetry={retry} />
        ) : members === null ? (
          <LoadingState />
        ) : (
          <EmptyState icon={UserX} title={t("common.empty")} />
        )}
      </Screen>
    );
  }
  return <MemberEditor target={target} />;
}

function MemberEditor({ target }: { target: Member }) {
  const { t } = useTranslation();
  const { wid, workspace, member: me, actor } = useActiveWorkspace();
  const canEditRole = usePermission("members.edit-role");
  const canDisable = usePermission("members.disable");
  const canRemove = usePermission("members.remove");
  const canSeeRoles = usePermission("workspace-roles.view");
  const myKeys = useWorkspaceKeys(WORKSPACE_KEYS);
  const { roles, byId } = useWorkspaceRoles(wid);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"remove" | "transfer" | null>(null);

  const iAmAdmin = isWorkspaceAdmin(me);
  const keysOf = (roleId: string) =>
    roleId === WORKSPACE_ADMIN_ROLE ? WORKSPACE_KEYS : (byId.get(roleId)?.permissions ?? []);
  // Mirrors outranks()/grantableRole() in rules.
  const outranks = (roleId: string) =>
    iAmAdmin || (roleId !== WORKSPACE_ADMIN_ROLE && canGrant(myKeys, keysOf(roleId)));

  const isSelf = target.id === actor.uid;
  const isCreator = isCreatorSeat(workspace, target.id);
  const reachable = !isSelf && !isCreator && outranks(target.roleId);
  const roleEditable = canEditRole && reachable;
  const statusEditable = canDisable && reachable;
  const removable = canRemove && reachable;
  const canTransfer =
    workspace?.ownerId === actor.uid &&
    !isSelf &&
    target.status === "active" &&
    target.roleId === WORKSPACE_ADMIN_ROLE;
  const currentLabel = roleLabel(t, target.roleId, byId.get(target.roleId));
  const active = target.status === "active";

  const report = (error: unknown) =>
    emitActionFeedback({
      message:
        error instanceof OfflineError
          ? t("errors.offline")
          : errorMessage(error),
      kind: "error",
    });

  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    try {
      await action();
      emitActionFeedback({ message, kind: "success" });
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = () => {
    const action = confirm;
    setConfirm(null);
    if (action === "remove") {
      removeMember(wid, target, actor)
        .then(() => {
          emitActionFeedback({
            message: t("members.removed"),
            kind: "success",
          });
          router.back();
        })
        .catch(report);
    } else if (action === "transfer") {
      transferOwnership(wid, target, actor)
        .then(() =>
          emitActionFeedback({
            message: t("workspace.transferred"),
            kind: "success",
          }),
        )
        .catch(report);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title={t("members.title")} back />}
      contentStyle={styles.content}
    >
      <Card style={styles.identity}>
        <Avatar name={target.displayName} size={sizes.avatarMd} />
        <AppText variant="h2" center>
          {target.displayName}
        </AppText>
        <AppText variant="bodySm" tone="secondary" ltr center>
          {target.email}
        </AppText>
        <View style={styles.tags}>
          <Badge
            label={currentLabel}
            tone={target.roleId === WORKSPACE_ADMIN_ROLE ? "ink" : "neutral"}
          />
          {isCreator ? <Badge label={t("workspace.role.creator")} tone="lime" /> : null}
          <Badge
            label={t(active ? "members.active" : "members.disabled")}
            tone={active ? "success" : "danger"}
          />
        </View>
      </Card>

      {isSelf ? (
        <InlineBanner tone="info" message={t("members.cannotEditSelf")} />
      ) : null}
      {isCreator && !isSelf ? (
        <InlineBanner tone="info" message={t("members.ownerLocked")} />
      ) : null}

      {roleEditable ? (
        <View>
          <SectionHeader title={t("members.role")} />
          <View style={styles.chips}>
            {(roles ?? [])
              .filter((role) => role.id === target.roleId || outranks(role.id))
              .map((role) => (
                <Chip
                  key={role.id}
                  label={roleLabel(t, role.id, role)}
                  selected={target.roleId === role.id}
                  disabled={busy}
                  onPress={() => {
                    if (role.id === target.roleId) return;
                    void run(
                      () => setMemberRole(wid, target, role.id, actor),
                      t("members.saved"),
                    );
                  }}
                />
              ))}
          </View>
        </View>
      ) : null}

      <GroupedList>
        {statusEditable ? (
          <ListRow
            label={t("members.active")}
            right={
              <Switch
                label={t("members.active")}
                value={active}
                disabled={busy}
                onValueChange={(on) =>
                  void run(
                    () => setMemberStatus(wid, target, on ? "active" : "disabled", actor),
                    t("members.saved"),
                  )
                }
              />
            }
          />
        ) : null}
        {canSeeRoles ? (
          <ListRow
            icon={ShieldCheck}
            label={t("members.permissions")}
            value={currentLabel}
            chevron
            onPress={() => router.push(`/roles/${target.roleId}`)}
          />
        ) : null}
      </GroupedList>

      {removable || canTransfer ? (
        <GroupedList>
          {canTransfer ? (
            <ListRow
              icon={Crown}
              label={t("workspace.transfer")}
              onPress={() => setConfirm("transfer")}
            />
          ) : null}
          {removable ? (
            <ListRow
              icon={UserMinus}
              label={t("members.remove")}
              destructive
              onPress={() => setConfirm("remove")}
            />
          ) : null}
        </GroupedList>
      ) : null}

      <ConfirmDialog
        visible={confirm !== null}
        title={
          confirm === "transfer" ? t("workspace.transfer") : t("members.remove")
        }
        message={
          confirm === "transfer"
            ? t("workspace.transferConfirm", { name: target.displayName })
            : t("members.removeConfirm", { name: target.displayName })
        }
        confirmLabel={
          confirm === "transfer" ? t("common.confirm") : t("members.remove")
        }
        cancelLabel={t("common.cancel")}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={onConfirm}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
  identity: {
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[5],
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    justifyContent: "center",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
});
