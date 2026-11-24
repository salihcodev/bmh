import { router } from "expo-router";
import {
  Building2,
  HandHeart,
  Info,
  LogOut,
  Palette,
  Pencil,
  Settings,
  Store,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/layout/screen-header";
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  GroupedList,
  ListRow,
  Screen,
  SectionHeader,
} from "@/components/ui";
import { useSignOut } from "@/features/auth/use-sign-out";
import { roleLabel } from "@/features/members/roles";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTranslation } from "@/localization";
import { useAuth } from "@/providers/auth-provider";
import { useWorkspace } from "@/providers/workspace-provider";
import { sizes, spacing } from "@/theme";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { profile, user } = useAuth();
  const { hasDashboard } = useCurrentUser();
  const userType = profile?.userType ?? "member";
  const { memberships, nameOf, workspaceId, switchWorkspace } = useWorkspace();
  const { signOut, busy, dialog } = useSignOut();
  const name = profile?.displayName || user?.displayName || "";
  const contact = user?.email || user?.phoneNumber || "";

  return (
    <Screen
      header={<ScreenHeader title={t("tabs.profile")} />}
      contentStyle={styles.content}
    >
      <Card style={styles.identity}>
        <Avatar
          name={name || contact || "?"}
          publicId={profile?.avatarPublicId}
          size={sizes.avatarLg}
        />
        <AppText variant="h2" center>
          {name}
        </AppText>
        {contact ? (
          <AppText variant="bodySm" tone="secondary" ltr center>
            {contact}
          </AppText>
        ) : null}
        {userType !== "member" ? (
          <Badge
            label={t(`manage.users.type.${userType}`)}
            tone={hasDashboard ? "lime" : "neutral"}
          />
        ) : null}
        <Button
          title={t("profile.edit")}
          icon={<Pencil />}
          variant="secondary"
          compact
          fullWidth={false}
          style={styles.edit}
          onPress={() => router.push("/edit-profile")}
        />
      </Card>

      <View>
        <SectionHeader title={t("profile.workspaces")} />
        {memberships.length === 0 ? (
          <Card>
            <AppText variant="bodySm" tone="secondary" center>
              {t("profile.noWorkspaces")}
            </AppText>
          </Card>
        ) : (
          <GroupedList>
            {memberships.map(({ workspaceId: wid, member }) => (
              <ListRow
                key={wid}
                icon={Building2}
                label={nameOf(wid) ?? ""}
                loading={!nameOf(wid)}
                hint={roleLabel(t, member.roleId)}
                right={
                  wid === workspaceId ? (
                    <Badge label={t("profile.current")} tone="lime" />
                  ) : undefined
                }
                chevron={wid !== workspaceId}
                onPress={
                  wid === workspaceId ? undefined : () => switchWorkspace(wid)
                }
              />
            ))}
          </GroupedList>
        )}
      </View>

      <View>
        <SectionHeader title={t("profile.preferences")} />
        <GroupedList>
          <ListRow
            icon={Palette}
            label={t("preferences.appearance")}
            onPress={() => router.push("/appearance")}
          />
          <ListRow
            icon={Settings}
            label={t("tabs.settings")}
            onPress={() => router.push("/settings")}
          />
          <ListRow
            icon={HandHeart}
            tile="lime"
            label={t("profile.support")}
            onPress={() => router.push("/support")}
          />
          <ListRow
            icon={Info}
            label={t("profile.about")}
            onPress={() => router.push("/about")}
          />
          {userType === "member" ? (
            <ListRow
              icon={Store}
              label={t("supplier.entry")}
              hint={t(`supplier.entryHint.${profile?.supplierStatus ?? "none"}`)}
              onPress={() => router.push("/supplier")}
            />
          ) : null}
        </GroupedList>
      </View>

      <GroupedList>
        <ListRow
          icon={LogOut}
          label={busy ? t("preferences.signingOut") : t("auth.signOut")}
          destructive
          disabled={busy}
          chevron={false}
          onPress={signOut}
        />
      </GroupedList>

      {dialog}
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
  edit: { alignSelf: "center", marginTop: spacing[2] },
});
