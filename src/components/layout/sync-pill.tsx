import { CloudOff, RefreshCw, RefreshCwOff } from "lucide-react-native";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { AppText, Button, Card, Sheet } from "@/components/ui";
import { useTranslation } from "@/localization";
import { SystemMessage } from "@/services/content/system-message";
import { outbox } from "@/services/sync/outbox-runtime";
import { useSyncStatus } from "@/services/sync/sync-status";
import { useSyncStore } from "@/services/sync/sync-store";
import { iconStroke, radii, sizes, spacing, useTheme } from "@/theme";
import { enter, layout, timings, useMotion } from "@/theme/motion";

const SPIN_MS = 1000;

/**
 * Sync status pill: sync icon plus a short status word. `compact` is the header form: an outlined
 * 44pt chip that lines up with the header icon buttons, using the short words. `iconOnly` drops the word.
 */
export function SyncPill({
  compact = false,
  iconOnly = false,
}: {
  compact?: boolean;
  iconOnly?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const status = useSyncStatus();
  const [open, setOpen] = useState(false);

  const tone = {
    offline: { bg: colors.warningTint, fg: colors.warning, Icon: CloudOff },
    syncing: { bg: colors.infoTint, fg: colors.info, Icon: RefreshCw },
    synced: { bg: colors.successTint, fg: colors.success, Icon: RefreshCw },
    error: { bg: colors.dangerTint, fg: colors.danger, Icon: RefreshCwOff },
  }[status.state];

  let label: string;
  if (status.state === "error") label = t("sync.problem");
  else if (status.state === "offline")
    label =
      status.waiting > 0
        ? `${t("sync.offline")} · ${t("sync.waiting", { count: status.waiting })}`
        : t("sync.offline");
  else if (status.state === "syncing")
    label =
      status.waiting > 0
        ? t("sync.waiting", { count: status.waiting })
        : t("sync.syncing");
  else label = t("sync.synced");

  let short: string;
  if (status.state === "error") short = t("sync.short.error");
  else if (status.waiting > 0 && status.state !== "synced")
    short = t("sync.short.pending", { count: status.waiting });
  else short = t(`sync.short.${status.state}`);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={[
          styles.pill,
          compact
            ? [
                styles.compact,
                iconOnly && styles.iconOnly,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]
            : { backgroundColor: tone.bg },
        ]}
      >
        <SpinningIcon spinning={status.state === "syncing"}>
          <tone.Icon
            size={compact ? sizes.icon : sizes.iconSm}
            color={tone.fg}
            strokeWidth={iconStroke}
          />
        </SpinningIcon>
        {iconOnly ? null : (
          <Animated.View key={short} entering={enter.fade()} layout={layout()}>
            <AppText
              variant="caption"
              weight="semibold"
              numberOfLines={1}
              style={{ color: tone.fg }}
            >
              {compact ? short : label}
            </AppText>
          </Animated.View>
        )}
      </Pressable>
      <SyncSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function SpinningIcon({
  spinning,
  children,
}: {
  spinning: boolean;
  children: ReactNode;
}) {
  const { reduced } = useMotion();
  const rotation = useSharedValue(0);
  useEffect(() => {
    if (spinning && !reduced) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: SPIN_MS, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, timings.fast);
    }
    return () => cancelAnimation(rotation);
  }, [spinning, reduced, rotation]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function SyncSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const status = useSyncStatus();
  const dismiss = useSyncStore((state) => state.dismiss);
  const failedJobs = status.jobs.filter((job) => job.status === "failed");
  const pendingJobs = status.jobs.filter(
    (job) => job.status === "pending" || job.status === "syncing",
  );

  return (
    <Sheet visible={visible} title={t("sync.sheetTitle")} onClose={onClose}>
      <AppText muted>{t("sync.appOpenHint")}</AppText>
      <SystemMessage messageKey="sync_queue_info" fallback={t("sync.queueInfo")} />
      {status.previousRunPending && status.isOnline ? (
        <AppText muted>{t("sync.previousRun")}</AppText>
      ) : null}
      {status.waiting > 0 ? (
        <AppText>{t("sync.waiting", { count: status.waiting })}</AppText>
      ) : null}

      {status.failures.length > 0 ? (
        <View style={styles.group}>
          <AppText variant="label">{t("sync.failuresTitle")}</AppText>
          {status.failures.map((failure) => (
            <Card key={failure.id} style={styles.item}>
              <AppText variant="label">{failure.label}</AppText>
              <AppText variant="caption" style={{ color: colors.danger }}>
                {failure.message}
              </AppText>
              <View style={styles.actions}>
                {failure.retry ? (
                  <Button
                    compact
                    title={t("sync.retry")}
                    onPress={() => {
                      dismiss(failure.id);
                      failure.retry?.();
                    }}
                  />
                ) : null}
                <Button
                  compact
                  variant="secondary"
                  title={t("sync.dismiss")}
                  onPress={() => dismiss(failure.id)}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {pendingJobs.length + failedJobs.length > 0 ? (
        <View style={styles.group}>
          <AppText variant="label">{t("sync.outboxTitle")}</AppText>
          {[...failedJobs, ...pendingJobs].map((job) => (
            <Card key={job.id} style={styles.item}>
              <AppText variant="label">
                {t(`sync.jobs.${job.type}`, { defaultValue: t("sync.jobs.unknown") })}
              </AppText>
              {job.lastError ? (
                <AppText variant="caption" style={{ color: colors.danger }}>
                  {job.lastError}
                </AppText>
              ) : null}
              <View style={styles.actions}>
                <Button
                  compact
                  title={t("sync.retry")}
                  onPress={() => {
                    outbox.retry(job.id);
                    void outbox.flush();
                  }}
                />
                <Button
                  compact
                  variant="secondary"
                  title={t("sync.dismiss")}
                  onPress={() => outbox.dismiss(job.id)}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {status.state === "synced" ? (
        <AppText>{t("sync.noIssues")}</AppText>
      ) : null}
      <Button
        variant="secondary"
        title={t("sync.openQueue")}
        onPress={() => {
          onClose();
          router.push("/sync");
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.pill,
    maxWidth: 260,
    alignSelf: "flex-start",
  },
  compact: {
    height: sizes.iconButton,
    minWidth: sizes.iconButton,
    paddingHorizontal: spacing[3],
    paddingVertical: 0,
    borderWidth: 1,
    borderRadius: radii.iconButton,
    justifyContent: "center",
    gap: spacing[2],
    maxWidth: 160,
    alignSelf: "center",
  },
  iconOnly: { width: sizes.iconButton, paddingHorizontal: 0 },
  group: { gap: spacing[2], marginTop: spacing[2] },
  item: { gap: spacing[1], marginBottom: 0 },
  actions: { flexDirection: "row", gap: spacing[2], marginTop: spacing[1] },
});
