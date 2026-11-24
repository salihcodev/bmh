import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";

import {
  AppText,
  BottomSheet,
  Button,
  Chip,
  confirmAsync,
  Fab,
  FilterButton,
  FilterGroup,
  InlineBanner,
  ProgressBar,
  Screen,
  Switch,
  TextField,
  useToast,
} from "@/components/ui";
import { AdminHeader } from "@/features/admin/admin-header";
import { MediaGrid } from "@/features/admin/media-grid";
import { useAdminAction } from "@/features/admin/use-admin-action";
import { useUploader } from "@/features/admin/use-uploader";
import { useCurrentUser } from "@/hooks/use-current-user";
import { LANGUAGE_NAMES, useTranslation } from "@/localization";
import { removeMedia } from "@/services/admin/admin-writes";
import { useMediaAssets, type MediaAsset } from "@/services/admin/use-admin";
import { cloudinaryUrl } from "@/services/media/cloudinary";
import { STAFF_UPLOAD_ENTITIES, type MediaEntity } from "@/services/media/groups";
import { presetFor } from "@/services/media/upload";
import { radii, screenPadding, sizes, spacing } from "@/theme";

export default function ManageMedia() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<MediaEntity | null>(null);
  const [removed, setRemoved] = useState(false);
  const media = useMediaAssets(kind, removed);
  const { can } = useCurrentUser();
  const { actor, run } = useAdminAction();
  const configured = presetFor("other") !== null;
  const uploader = useUploader(actor);
  const [sheet, setSheet] = useState(false);
  const [detail, setDetail] = useState<MediaAsset | null>(null);

  const filters = (
    <View style={styles.filters}>
      <FilterButton
        activeCount={(kind ? 1 : 0) + (removed ? 1 : 0)}
        onReset={() => {
          setKind(null);
          setRemoved(false);
        }}
      >
        <FilterGroup label={t("manage.media.kind")}>
          <Chip
            label={t("common.all")}
            selected={kind === null}
            onPress={() => setKind(null)}
          />
          {STAFF_UPLOAD_ENTITIES.map((k) => (
            <Chip
              key={k}
              label={t(`manage.media.kinds.${k}`)}
              selected={kind === k}
              onPress={() => setKind(k)}
            />
          ))}
        </FilterGroup>
        <View style={styles.toggleRow}>
          <AppText variant="bodyLg" style={styles.flex}>
            {t("manage.media.showRemoved")}
          </AppText>
          <Switch
            label={t("manage.media.showRemoved")}
            value={removed}
            onValueChange={setRemoved}
          />
        </View>
      </FilterButton>
    </View>
  );

  return (
    <Screen
      scroll={false}
      header={<AdminHeader title={t("manage.media.title")} />}
    >
      {!configured ? (
        <View style={styles.pad}>
          <InlineBanner
            tone="warning"
            message={t("manage.media.notConfigured")}
          />
        </View>
      ) : null}
      <MediaGrid media={media} onSelect={setDetail} header={filters} />
      {configured && can("media.upload") ? (
        <Fab
          label={t("manage.media.upload")}
          icon={<Plus />}
          extended
          onPress={() => setSheet(true)}
        />
      ) : null}
      <UploadSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        uploader={uploader}
      />
      <DetailSheet
        asset={detail}
        onClose={() => setDetail(null)}
        canRemove={can("media.delete")}
        onRemove={async (asset) => {
          // Close the sheet first so the confirmation is not stacked on another modal.
          setDetail(null);
          const confirmed = await confirmAsync({
            title: t("manage.media.removeTitle"),
            message: t("manage.media.removeBody"),
            confirmLabel: t("manage.media.remove"),
            cancelLabel: t("common.cancel"),
            destructive: true,
          });
          if (!confirmed) return;
          await run(
            (a) => removeMedia(a, { id: asset.id, publicId: asset.publicId }, false),
            t("manage.media.removed"),
          );
        }}
      />
    </Screen>
  );
}

function UploadSheet({
  visible,
  onClose,
  uploader,
}: {
  visible: boolean;
  onClose: () => void;
  uploader: ReturnType<typeof useUploader>;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<MediaEntity>("banner");
  const [lang, setLang] = useState<"ar" | "en" | null>(null);
  const [label, setLabel] = useState("");
  const { state } = uploader;
  const preview = "image" in state && state.image ? state.image.uri : null;
  const previewWidth = Math.min(width, sizes.maxContent) - screenPadding * 2;

  const close = () => {
    if (state.phase === "uploading") return;
    uploader.reset();
    setLabel("");
    onClose();
  };

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    showToast({ kind: "success", message: t("manage.media.copied") });
  };

  let footer = null;
  if (state.phase === "uploading") {
    footer = (
      <Button
        title={t("manage.media.cancel")}
        variant="secondary"
        onPress={uploader.cancel}
      />
    );
  } else if (state.phase === "done") {
    footer = (
      <>
        <Button title={t("common.done")} onPress={close} />
        <Button
          title={t("manage.media.undo")}
          variant="ghost"
          onPress={async () => {
            const outcome = await uploader.undo();
            if (outcome === "undone")
              showToast({ kind: "success", message: t("manage.media.undone") });
            else
              showToast({
                kind: "warning",
                message: t(
                  outcome === "expired"
                    ? "manage.media.undoExpired"
                    : "manage.media.undoFailed",
                ),
              });
          }}
        />
      </>
    );
  } else if (state.phase === "picked") {
    footer = (
      <Button
        title={t("manage.media.upload")}
        variant="lime"
        onPress={() => uploader.upload({ entity: kind, lang, label })}
      />
    );
  } else {
    footer = (
      <Button
        title={t("manage.media.choose")}
        onPress={() => uploader.pick(kind)}
      />
    );
  }

  return (
    <BottomSheet
      visible={visible}
      title={t("manage.media.upload")}
      onClose={close}
      footer={footer}
    >
      <View style={styles.sheet}>
        {preview ? (
          <Image
            source={{ uri: preview }}
            style={[
              styles.preview,
              { width: previewWidth, height: previewWidth / 2 },
            ]}
            contentFit="contain"
          />
        ) : null}
        {state.phase === "error" ? (
          <InlineBanner tone="danger" message={state.message} />
        ) : null}
        {state.phase === "picked" && state.warning ? (
          <InlineBanner tone="warning" message={state.warning} />
        ) : null}
        {state.phase === "uploading" ? (
          <View style={styles.progress}>
            <AppText variant="label">
              {t("manage.media.uploading", {
                percent: Math.round(state.progress * 100),
              })}
            </AppText>
            <ProgressBar
              value={state.progress}
              label={t("manage.media.uploading", {
                percent: Math.round(state.progress * 100),
              })}
            />
          </View>
        ) : null}
        {state.phase === "done" ? (
          <View style={styles.result}>
            <InlineBanner tone="success" message={t("manage.media.uploaded")} />
            <AppText variant="bodySm" ltr selectable>
              {state.result.publicId}
            </AppText>
            <View style={styles.row}>
              <Button
                compact
                fullWidth={false}
                variant="secondary"
                title={t("manage.media.copyId")}
                onPress={() => copy(state.result.publicId)}
              />
              <Button
                compact
                fullWidth={false}
                variant="secondary"
                title={t("manage.media.copyUrl")}
                onPress={() =>
                  copy(
                    cloudinaryUrl(state.result.publicId) ??
                      state.result.secureUrl,
                  )
                }
              />
            </View>
          </View>
        ) : null}
        {state.phase === "idle" ||
        state.phase === "picked" ||
        state.phase === "error" ? (
          <>
            <AppText variant="label">{t("manage.media.kind")}</AppText>
            <View style={styles.row}>
              {STAFF_UPLOAD_ENTITIES.map((k) => (
                <Chip
                  key={k}
                  label={t(`manage.media.kinds.${k}`)}
                  selected={kind === k}
                  onPress={() => setKind(k)}
                />
              ))}
            </View>
            <AppText variant="label">{t("manage.media.lang")}</AppText>
            <View style={styles.row}>
              <Chip
                label={t("manage.media.langNone")}
                selected={lang === null}
                onPress={() => setLang(null)}
              />
              <Chip
                label={LANGUAGE_NAMES.ar}
                selected={lang === "ar"}
                onPress={() => setLang("ar")}
              />
              <Chip
                label={LANGUAGE_NAMES.en}
                selected={lang === "en"}
                onPress={() => setLang("en")}
              />
            </View>
            <TextField
              label={t("manage.media.label")}
              value={label}
              onChangeText={setLabel}
              maxLength={120}
            />
            {state.phase === "picked" ? (
              <Button
                title={t("manage.media.choose")}
                variant="ghost"
                onPress={() => uploader.pick(kind)}
              />
            ) : null}
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}

function DetailSheet({
  asset,
  onClose,
  canRemove,
  onRemove,
}: {
  asset: MediaAsset | null;
  onClose: () => void;
  canRemove: boolean;
  onRemove: (asset: MediaAsset) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const previewWidth = Math.min(width, sizes.maxContent) - screenPadding * 2;
  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    showToast({ kind: "success", message: t("manage.media.copied") });
  };
  const uri = asset
    ? cloudinaryUrl(asset.publicId, { width: previewWidth * 2 })
    : null;
  return (
    <BottomSheet
      visible={!!asset}
      title={t("manage.media.details")}
      onClose={onClose}
      footer={
        asset && !asset.isDeleted && canRemove ? (
          <Button
            title={t("manage.media.remove")}
            variant="destructive"
            onPress={() => onRemove(asset)}
          />
        ) : null
      }
    >
      {asset ? (
        <View style={styles.sheet}>
          {uri ? (
            <Image
              source={{ uri }}
              style={[
                styles.preview,
                {
                  width: previewWidth,
                  height:
                    asset.width && asset.height
                      ? (previewWidth * asset.height) / asset.width
                      : previewWidth / 2,
                },
              ]}
              contentFit="contain"
              cachePolicy="disk"
            />
          ) : null}
          {asset.label ? <AppText variant="body">{asset.label}</AppText> : null}
          <AppText variant="bodySm" ltr selectable>
            {asset.publicId}
          </AppText>
          {asset.width && asset.height ? (
            <AppText variant="caption" tone="secondary">
              {t("manage.media.size", {
                width: asset.width,
                height: asset.height,
                kb: Math.round(asset.bytes / 1024),
              })}
            </AppText>
          ) : null}
          <View style={styles.row}>
            <Button
              compact
              fullWidth={false}
              variant="secondary"
              title={t("manage.media.copyId")}
              onPress={() => copy(asset.publicId)}
            />
            <Button
              compact
              fullWidth={false}
              variant="secondary"
              title={t("manage.media.copyUrl")}
              onPress={() => copy(cloudinaryUrl(asset.publicId) ?? "")}
            />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding, paddingBottom: spacing[3] },
  filters: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingBottom: spacing[3],
  },
  toggleRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    minHeight: 44,
  },
  flex: { flex: 1 },
  sheet: { gap: spacing[3] },
  preview: { borderRadius: radii.md, alignSelf: "center" },
  progress: { gap: spacing[2] },
  result: { gap: spacing[2] },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
});
