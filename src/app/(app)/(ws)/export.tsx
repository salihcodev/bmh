import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ScreenHeader } from "@/components/layout/screen-header";
import {
  AppText,
  Button,
  Card,
  Chip,
  InlineBanner,
  NoPermissionState,
  Screen,
  SectionHeader,
  Select,
} from "@/components/ui";
import {
  buildBeneficiariesDoc,
  buildProfileDoc,
  buildSessionDoc,
  EXPORT_FORMATS,
  type ExportContext,
  type ExportDoc,
  type ExportFormat,
  type ExportPreset,
} from "@/domain/export";
import { formatPhone } from "@/domain/phone";
import { usePlaces } from "@/features/places/use-places";
import { useSessions } from "@/features/sessions/use-sessions";
import { emitActionFeedback, errorMessage } from "@/lib/action-feedback";
import { isLanguage, isRTLLanguage, useTranslation } from "@/localization";
import { useActiveWorkspace, usePermission } from "@/providers/workspace-provider";
import {
  fetchBeneficiaries,
  fetchProfile,
  fetchSessionReport,
  logExport,
  shareExport,
} from "@/services/export/api";
import { spacing } from "@/theme";
import { formatDate, formatDateTime } from "@/utils/format";

const ALL = "__all__";
const FORMAT_LABEL: Record<ExportFormat, string> = {
  xlsx: "export.formatXlsx",
  pdf: "export.formatPdf",
  csv: "export.formatCsv",
};

export default function ExportScreen() {
  const params = useLocalSearchParams<{
    preset?: string;
    beneficiaryId?: string;
    sessionId?: string;
  }>();
  const { t, i18n } = useTranslation();
  const { wid, actor } = useActiveWorkspace();
  const canExport = usePermission("beneficiaries.export");
  const canHistory = usePermission("history.view");
  const seeAllSessions = usePermission("sessions.view");
  const places = usePlaces(wid);
  const { sessions } = useSessions(wid, actor.uid, seeAllSessions);

  const initialPreset: ExportPreset =
    params.preset === "profile" && params.beneficiaryId
      ? "profile"
      : params.preset === "session"
        ? "session"
        : "beneficiaries";
  const [preset, setPreset] = useState<ExportPreset>(initialPreset);
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [cityId, setCityId] = useState<string>(ALL);
  const [areaId, setAreaId] = useState<string>(ALL);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(canHistory);
  const [sessionId, setSessionId] = useState<string | null>(
    params.sessionId ?? null,
  );
  const [status, setStatus] = useState<{
    rows: number;
    fromCache: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rtl = isLanguage(i18n.language) ? isRTLLanguage(i18n.language) : true;

  if (!canExport) {
    return (
      <Screen
        scroll={false}
        header={<ScreenHeader title={t("export.title")} back />}
      >
        <NoPermissionState hint={t("export.noPermission")} />
      </Screen>
    );
  }

  const context = (): ExportContext => ({
    t: (key, options) => t(key, options ?? {}) as string,
    date: formatDate,
    dateTime: formatDateTime,
    phone: (e164) => formatPhone(e164),
    now: new Date(),
  });

  const build = async (): Promise<{
    doc: ExportDoc;
    rows: number;
    fromCache: boolean;
    targetId: string | null;
  } | null> => {
    const ctx = context();
    if (preset === "profile") {
      if (!params.beneficiaryId) return null;
      const data = await fetchProfile(
        wid,
        params.beneficiaryId,
        includeHistory && canHistory,
      );
      if (!data) return null;
      return {
        doc: buildProfileDoc(
          data.beneficiary,
          data.history,
          data.assistance,
          ctx,
          canExport,
        ),
        rows: 1,
        fromCache: data.fromCache,
        targetId: data.beneficiary.id,
      };
    }
    if (preset === "session") {
      if (!sessionId) return null;
      const data = await fetchSessionReport(wid, sessionId);
      if (!data) return null;
      return {
        doc: buildSessionDoc(data.session, data.items, ctx),
        rows: data.items.length,
        fromCache: data.fromCache,
        targetId: sessionId,
      };
    }
    const scope = {
      cityId: cityId === ALL ? undefined : cityId,
      areaId: areaId === ALL ? undefined : areaId,
      includeArchived,
    };
    const { list, fromCache } = await fetchBeneficiaries(wid, scope);
    const doc = buildBeneficiariesDoc(list, ctx, {
      cityName: scope.cityId
        ? places.cityById.get(scope.cityId)?.name
        : undefined,
      areaName: scope.areaId
        ? places.areaById.get(scope.areaId)?.name
        : undefined,
      includeLocation: canExport,
    });
    return {
      doc,
      rows: list.length,
      fromCache,
      targetId: scope.areaId ?? scope.cityId ?? null,
    };
  };

  const generate = async () => {
    setError(null);
    try {
      const built = await build();
      if (!built || built.doc.sections.every((s) => s.rows.length === 0)) {
        setError(t("export.empty"));
        return;
      }
      setStatus({ rows: built.rows, fromCache: built.fromCache });
      await shareExport(built.doc, format, {
        baseName: built.doc.title,
        rtl,
        footer: `${t("app.name")} · ${t("export.generatedAt")}: ${built.doc.generatedAt}`,
        dialogTitle: t("export.title"),
      });
      logExport(wid, actor, {
        preset,
        format,
        rows: built.rows,
        fromCache: built.fromCache,
        targetId: built.targetId,
      });
      emitActionFeedback({ message: t("export.done"), kind: "success" });
    } catch (exc) {
      setError(
        exc instanceof Error && exc.message === "share_unavailable"
          ? t("export.shareUnavailable")
          : errorMessage(exc),
      );
    }
  };

  const presets: ExportPreset[] = params.beneficiaryId
    ? ["beneficiaries", "profile", "session"]
    : ["beneficiaries", "session"];
  const presetLabel: Record<ExportPreset, string> = {
    beneficiaries: t("export.presetList"),
    profile: t("export.presetProfile"),
    session: t("export.presetSession"),
  };
  const cityAreas = cityId === ALL ? [] : places.areasOf(cityId, true);

  return (
    <Screen
      header={<ScreenHeader title={t("export.title")} back />}
      contentStyle={styles.content}
      footer={
        <Button
          title={t("export.generate")}
          loadingTitle={t("export.generating")}
          disabled={
            (preset === "session" && !sessionId) ||
            (preset === "profile" && !params.beneficiaryId)
          }
          onPress={generate}
        />
      }
    >
      <View>
        <SectionHeader title={t("export.preset")} />
        <View style={styles.chips}>
          {presets.map((p) => (
            <Chip
              key={p}
              label={presetLabel[p]}
              selected={preset === p}
              onPress={() => setPreset(p)}
            />
          ))}
        </View>
        {preset === "profile" && !params.beneficiaryId ? (
          <AppText variant="bodySm" tone="secondary">
            {t("export.pickBeneficiary")}
          </AppText>
        ) : null}
      </View>

      {preset === "beneficiaries" ? (
        <View>
          <SectionHeader title={t("export.scope")} />
          <Card>
            <Select
              label={t("export.columns.city")}
              value={cityId}
              options={[
                { value: ALL, label: t("export.allCities") },
                ...places.cities.map((c) => ({ value: c.id, label: c.name })),
              ]}
              onChange={(value) => {
                setCityId(value);
                setAreaId(ALL);
              }}
            />
            {cityId !== ALL ? (
              <Select
                label={t("export.columns.area")}
                value={areaId}
                options={[
                  { value: ALL, label: t("export.allAreas") },
                  ...cityAreas.map((a) => ({ value: a.id, label: a.name })),
                ]}
                onChange={setAreaId}
              />
            ) : null}
            <View style={styles.chips}>
              <Chip
                label={t("export.includeArchived")}
                selected={includeArchived}
                onPress={() => setIncludeArchived((v) => !v)}
              />
            </View>
          </Card>
        </View>
      ) : null}

      {preset === "session" ? (
        <View>
          <SectionHeader title={t("export.pickSession")} />
          <Card>
            {sessions && sessions.length === 0 ? (
              <AppText variant="bodySm" tone="secondary" style={styles.note}>
                {t("export.noSessions")}
              </AppText>
            ) : null}
            <Select
              label={t("export.pickSession")}
              value={sessionId}
              options={(sessions ?? []).map((s) => ({
                value: s.id,
                label: s.name,
                hint: `${s.cityName} · ${t(`sessions.status.${s.status}`)}`,
              }))}
              onChange={setSessionId}
            />
          </Card>
        </View>
      ) : null}

      {preset === "profile" && canHistory ? (
        <View style={styles.chips}>
          <Chip
            label={t("export.includeHistory")}
            selected={includeHistory}
            onPress={() => setIncludeHistory((v) => !v)}
          />
        </View>
      ) : null}

      <View>
        <SectionHeader title={t("export.format")} />
        <View style={styles.chips}>
          {EXPORT_FORMATS.map((f) => (
            <Chip
              key={f}
              label={t(FORMAT_LABEL[f])}
              selected={format === f}
              onPress={() => setFormat(f)}
            />
          ))}
        </View>
      </View>

      <InlineBanner tone="info" message={t("export.offlineNote")} />
      {status ? (
        <InlineBanner
          tone={status.fromCache ? "offline" : "success"}
          message={`${t("export.rows", { count: status.rows })}${status.fromCache ? ` · ${t("export.fromCache")}` : ""}`}
        />
      ) : null}
      {error ? <InlineBanner tone="danger" message={error} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  note: { marginBottom: spacing[3] },
});
