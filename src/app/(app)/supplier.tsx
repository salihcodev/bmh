import { Store } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/layout/screen-header";
import {
  AppText,
  Button,
  Card,
  ErrorState,
  InlineBanner,
  Screen,
  SkeletonCard,
  TextField,
  useDelayedLoading,
} from "@/components/ui";
import { SUPPLIER_MESSAGE_MAX } from "@/domain/supplier";
import { emitActionFeedback, errorMessage } from "@/lib/action-feedback";
import { useTranslation } from "@/localization";
import { useAuth } from "@/providers/auth-provider";
import { requestSupplier } from "@/services/suppliers/api";
import { useOwnSupplierRequest } from "@/services/suppliers/use-supplier";
import { checkOnline } from "@/services/sync/connectivity";
import { sizes, spacing, useTheme } from "@/theme";

/** USER-03: a member asks to become a supplier; staff with suppliers.approve review it. */
export default function SupplierRequestScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const own = useOwnSupplierRequest(profile?.id ?? null);
  const showSkeleton = useDelayedLoading(own.status === "loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const supplierStatus = profile?.supplierStatus ?? "none";
  const isSupplier = profile?.userType === "supplier";
  const canAsk =
    !!profile &&
    profile.userType === "member" &&
    (supplierStatus === "none" || supplierStatus === "rejected");

  const submit = async () => {
    if (!profile) return;
    if (!(await checkOnline())) {
      emitActionFeedback({ message: t("errors.offline"), kind: "error" });
      return;
    }
    setBusy(true);
    try {
      await requestSupplier(profile, message);
      setMessage("");
      emitActionFeedback({ message: t("supplier.sent"), kind: "success" });
    } catch (error) {
      emitActionFeedback({ message: errorMessage(error), kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title={t("supplier.title")} back />}
      contentStyle={styles.content}
    >
      <Card style={styles.intro}>
        <Store size={sizes.iconLg} color={colors.textPrimary} />
        <AppText variant="h3" center>
          {t("supplier.introTitle")}
        </AppText>
        <AppText variant="bodySm" tone="secondary" center>
          {t("supplier.intro")}
        </AppText>
      </Card>

      {own.status === "loading" ? (
        showSkeleton ? (
          <SkeletonCard />
        ) : null
      ) : own.status === "error" ? (
        <ErrorState message={t("supplier.loadFailed")} onRetry={own.retry} />
      ) : (
        <View style={styles.content}>
          {isSupplier ? (
            <InlineBanner tone="success" message={t("supplier.approved")} />
          ) : supplierStatus === "pending" ? (
            <InlineBanner tone="info" message={t("supplier.pending")} />
          ) : supplierStatus === "rejected" ? (
            <InlineBanner
              tone="warning"
              message={
                own.request?.reason
                  ? t("supplier.rejectedWithReason", { reason: own.request.reason })
                  : t("supplier.rejected")
              }
            />
          ) : null}
          {profile && !isSupplier && profile.userType !== "member" ? (
            <InlineBanner tone="info" message={t("supplier.staffOnly")} />
          ) : null}
          {canAsk ? (
            <>
              <TextField
                label={t("supplier.messageLabel")}
                hint={t("supplier.messageHint")}
                value={message}
                onChangeText={setMessage}
                maxLength={SUPPLIER_MESSAGE_MAX}
                multiline
              />
              <Button
                title={supplierStatus === "rejected" ? t("supplier.askAgain") : t("supplier.ask")}
                loading={busy}
                onPress={submit}
              />
            </>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  intro: { alignItems: "center", gap: spacing[2], paddingVertical: spacing[5] },
});
