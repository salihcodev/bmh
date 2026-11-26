import { reloadAppAsync } from "expo";
import { StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/ui";
import { useTranslation } from "@/localization";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/theme";

import { Splash } from "./splash";

/** Route-level loading screen: the splash's finished frame, with a spinner if loading runs long. */
export function BrandLoading() {
  const failure = useAuth().profileFailure;
  if (failure) return <ProfileUnavailable failure={failure} />;
  return <Splash mode="hold" spinner />;
}

function ProfileUnavailable({ failure }: { failure: "deleted" | "unreachable" }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { signOutUser } = useAuth();
  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ErrorState
        message={t(failure === "deleted" ? "states.databaseDeleted" : "states.dataUnreachable")}
        onRetry={() => {
          void reloadAppAsync("profile-unavailable");
        }}
        secondaryLabel={t("auth.signOut")}
        onSecondary={() => {
          void signOutUser({ force: true });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "center" },
});
