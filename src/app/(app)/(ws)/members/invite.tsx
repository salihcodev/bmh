import { Link2 } from "lucide-react-native";
import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/layout/screen-header";
import {
  AppText,
  Button,
  Card,
  Chip,
  InlineBanner,
  Screen,
  SectionHeader,
} from "@/components/ui";
import { roleLabel, useWorkspaceRoles } from "@/features/members/roles";
import { PermissionGate } from "@/features/permissions/permission-gate";
import { errorMessage } from "@/lib/action-feedback";
import { useTranslation } from "@/localization";
import {
  useActiveWorkspace,
  usePermission,
  useWorkspaceKeys,
} from "@/providers/workspace-provider";
import { canGrant, isWorkspaceAdmin } from "@/services/permissions/can";
import {
  assignableKeys,
  WORKSPACE_ADMIN_ROLE,
  WORKSPACE_MEMBER_ROLE,
} from "@/services/permissions/catalog";
import { OfflineError } from "@/services/sync/connectivity";
import { createInvite } from "@/services/workspaces/api";
import { iconStroke, radii, sizes, spacing, useTheme } from "@/theme";

const WORKSPACE_KEYS = assignableKeys("workspace");

export default function InviteScreen() {
  const canInvite = usePermission("members.invite");
  return (
    <PermissionGate allowed={canInvite} fallback="/members">
      <InviteForm />
    </PermissionGate>
  );
}

function InviteForm() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { wid, workspace, member, actor } = useActiveWorkspace();
  const myKeys = useWorkspaceKeys(WORKSPACE_KEYS);
  const { roles } = useWorkspaceRoles(wid);
  const [roleId, setRoleId] = useState<string>(WORKSPACE_MEMBER_ROLE);
  // Only roles the inviter could grant (rules: grantableRole).
  const options = (roles ?? []).filter((role) =>
    role.id === WORKSPACE_ADMIN_ROLE
      ? isWorkspaceAdmin(member)
      : canGrant(myKeys, role.permissions),
  );
  const selected = options.find((role) => role.id === roleId) ?? options[0];
  const [created, setCreated] = useState<{
    link: string;
    token: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const workspaceName = workspace?.name ?? "";
  const header = <ScreenHeader title={t("members.invite")} back />;

  const share = (invite: { link: string; token: string }) =>
    Share.share({
      message: t("members.shareMessage", {
        workspace: workspaceName,
        link: invite.link,
        code: invite.token,
      }),
    });

  const submit = async () => {
    if (!selected) return;
    setError(null);
    setBusy(true);
    try {
      const invite = await createInvite(
        { id: wid, name: workspaceName },
        { id: selected.id, name: roleLabel(t, selected.id, selected) },
        actor,
      );
      setCreated(invite);
      await share(invite);
    } catch (exc) {
      setError(
        exc instanceof OfflineError ? t("errors.offline") : errorMessage(exc),
      );
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <Screen
        header={header}
        contentStyle={styles.content}
        footer={
          <>
            <Button
              title={t("members.inviteShare")}
              onPress={() => share(created)}
            />
            <Button
              title={t("members.inviteCreate")}
              variant="secondary"
              onPress={() => setCreated(null)}
            />
          </>
        }
      >
        <Card style={styles.created}>
          <View style={[styles.tile, { backgroundColor: colors.accent }]}>
            <Link2
              size={sizes.icon}
              color={colors.onAccent}
              strokeWidth={iconStroke}
            />
          </View>
          <AppText variant="h3" center>
            {t("members.inviteCreated")}
          </AppText>
          <AppText variant="label" tone="secondary">
            {t("members.inviteCode")}
          </AppText>
          <AppText variant="bodyLg" weight="semibold" ltr selectable center>
            {created.token}
          </AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      contentStyle={styles.content}
      footer={
        <Button
          title={t("members.inviteCreate")}
          loading={busy}
          disabled={busy || !selected}
          onPress={submit}
        />
      }
    >
      <View>
        <SectionHeader title={t("members.inviteRole")} />
        <View style={styles.chips}>
          {options.map((role) => (
            <Chip
              key={role.id}
              label={roleLabel(t, role.id, role)}
              selected={selected?.id === role.id}
              onPress={() => setRoleId(role.id)}
            />
          ))}
        </View>
      </View>
      {selected ? (
        <AppText variant="caption" tone="secondary">
          {t("members.inviteRoleHint", {
            count:
              selected.id === WORKSPACE_ADMIN_ROLE
                ? WORKSPACE_KEYS.length
                : selected.permissions.length,
          })}
        </AppText>
      ) : null}
      {error ? <InlineBanner tone="danger" message={error} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  tile: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  created: {
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[6],
  },
});
