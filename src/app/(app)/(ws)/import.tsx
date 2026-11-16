import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { FileSpreadsheet } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  InlineBanner,
  NoPermissionState,
  ProgressBar,
  Screen,
  SectionHeader,
  Select,
} from '@/components/ui';
import {
  guessMapping,
  IMPORT_FIELDS,
  IMPORT_MAX_ROWS,
  missingRequired,
  parseRow,
  planImport,
  readMatrix,
  REQUIRED_IMPORT_FIELDS,
  type ColumnMapping,
  type ImportField,
  type RowPlan,
} from '@/domain/import';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { loadImportContext, readImportFile, runImport, type ImportContext, type ImportResult } from '@/services/import/api';
import { OfflineError, useConnectivity } from '@/services/sync/connectivity';
import { radii, sizes, spacing, useTheme } from '@/theme';

type LoadedFile = { name: string; sheetName: string; headers: string[]; rows: { line: number; cells: string[] }[] };
type Step = 'pick' | 'map' | 'preview' | 'running' | 'done';

const UNMAPPED = '__none__';
const PREVIEW_ISSUES = 30;

export default function ImportScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { wid, actor } = useActiveWorkspace();
  const canImport = useCan('beneficiaries_import');
  const canManagePlaces = useCan('areas_manage');
  const isOnline = useConnectivity((state) => state.isOnline);

  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [context, setContext] = useState<ImportContext | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip');
  const [createMissing, setCreateMissing] = useState(canManagePlaces);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const describe = (exc: unknown) => (exc instanceof OfflineError ? t('import.needsConnection') : errorMessage(exc));

  const parsed = useMemo(
    () => (file ? file.rows.map((row) => parseRow(row.line, row.cells, mapping)) : []),
    [file, mapping],
  );
  const plan = useMemo(
    () => (context ? planImport(parsed, context.existing, { cities: context.cities, areas: context.areas }) : null),
    [parsed, context],
  );

  const pickFile = async () => {
    setError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/comma-separated-values',
        'public.comma-separated-values-text',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset) return;
    try {
      const { sheetName, matrix } = await readImportFile(asset.uri, asset.name);
      const { headers, rows } = readMatrix(matrix);
      if (rows.length === 0) return setError(t('import.emptyFile'));
      if (rows.length > IMPORT_MAX_ROWS) return setError(t('import.tooManyRows', { max: IMPORT_MAX_ROWS }));
      setFile({ name: asset.name, sheetName, headers, rows });
      setMapping(guessMapping(headers));
      setContext(null);
      setStep('map');
    } catch {
      setError(t('import.readFailed'));
    }
  };

  const goPreview = async () => {
    setError(null);
    try {
      setContext(await loadImportContext(wid));
      setStep('preview');
    } catch (exc) {
      setError(describe(exc));
    }
  };

  const start = async () => {
    if (!plan || !context || !file) return;
    setError(null);
    setStep('running');
    try {
      const outcome = await runImport(
        wid,
        plan,
        context,
        { duplicateAction, createMissing: createMissing && canManagePlaces, fileName: file.name },
        actor,
        (done, total) => setProgress({ done, total }),
      );
      setResult(outcome);
      setStep('done');
      if (!outcome.error) {
        emitActionFeedback({
          message: t('import.done', { created: outcome.created, updated: outcome.updated, skipped: outcome.skipped }),
          kind: 'success',
        });
      }
    } catch (exc) {
      setError(describe(exc));
      setStep('preview');
    }
  };

  const header = <AppHeader title={t('import.title')} back />;

  if (!canImport) {
    return (
      <Screen scroll={false} header={header}>
        <NoPermissionState hint={t('import.noPermission')} />
      </Screen>
    );
  }

  const fieldLabel = (field: ImportField) =>
    `${t(`import.fields.${field}`)}${REQUIRED_IMPORT_FIELDS.includes(field) ? ` (${t('import.required')})` : ''}`;
  const missing = missingRequired(mapping);
  const columnOptions = [
    { value: UNMAPPED, label: t('import.notMapped') },
    ...(file?.headers ?? []).map((header, index) => ({ value: String(index), label: header || `#${index + 1}` })),
  ];
  const errorBanner = error ? <InlineBanner tone="danger" message={error} /> : null;
  const stepIndex = step === 'pick' ? 1 : step === 'map' ? 2 : 3;
  const stepName = t(step === 'pick' ? 'import.stepFile' : step === 'map' ? 'import.stepMap' : 'import.stepPreview');

  const footer =
    step === 'pick' ? (
      <Button title={t('import.pickFile')} onPress={pickFile} />
    ) : step === 'map' ? (
      <Button
        title={t('import.next')}
        loadingTitle={t('import.loadingExisting')}
        disabled={missing.length > 0 || !isOnline}
        onPress={goPreview}
      />
    ) : step === 'preview' && plan ? (
      <Button
        title={t('import.start')}
        disabled={!isOnline || plan.counts.new + plan.counts.existing === 0}
        onPress={start}
      />
    ) : step === 'done' ? (
      <Button title={t('common.done')} onPress={() => router.back()} />
    ) : undefined;

  return (
    <Screen header={header} contentStyle={styles.content} footer={footer}>
      {step !== 'done' ? (
        <View style={styles.stepper}>
          <AppText variant="caption" tone="secondary">
            {t('import.step', { n: stepIndex, total: 3 })} · {stepName}
          </AppText>
          <ProgressBar value={stepIndex / 3} label={stepName} />
        </View>
      ) : null}

      {!isOnline ? <InlineBanner tone="offline" message={t('import.needsConnection')} /> : null}

      {step === 'pick' ? (
        <Card style={styles.intro}>
          <View style={[styles.tile, { backgroundColor: colors.accent }]}>
            <FileSpreadsheet size={sizes.icon} color={colors.onAccent} />
          </View>
          <AppText variant="body" center>
            {t('import.intro')}
          </AppText>
          <AppText variant="caption" tone="secondary" center>
            {t('import.template')}
          </AppText>
        </Card>
      ) : null}

      {step === 'map' && file ? (
        <>
          <Card style={styles.gapSm}>
            <AppText variant="body" weight="semibold">
              {t('import.fileRows', { name: file.name, count: file.rows.length })}
            </AppText>
            {file.sheetName ? (
              <AppText variant="caption" tone="secondary">
                {t('import.sheet', { name: file.sheetName })}
              </AppText>
            ) : null}
            <Button compact fullWidth={false} variant="secondary" title={t('import.changeFile')} onPress={pickFile} />
          </Card>
          <View>
            <SectionHeader title={t('import.mapping')} />
            <Card>
              <AppText variant="bodySm" tone="secondary" style={styles.hint}>
                {t('import.mappingHint')}
              </AppText>
              {IMPORT_FIELDS.map((field) => (
                <Select
                  key={field}
                  label={fieldLabel(field)}
                  value={mapping[field] === undefined ? UNMAPPED : String(mapping[field])}
                  options={columnOptions}
                  onChange={(value) =>
                    setMapping((current) => {
                      const next = { ...current };
                      if (value === UNMAPPED) delete next[field];
                      else next[field] = Number(value);
                      return next;
                    })
                  }
                />
              ))}
            </Card>
          </View>
          {missing.length > 0 ? (
            <InlineBanner
              tone="warning"
              message={t('import.missingRequired', { fields: missing.map((f) => t(`import.fields.${f}`)).join('، ') })}
            />
          ) : null}
          {errorBanner}
        </>
      ) : null}

      {step === 'preview' && plan ? (
        <PreviewStep
          plan={plan.rows}
          counts={plan.counts}
          missingPlaces={plan.missingAreas}
          canManagePlaces={canManagePlaces}
          createMissing={createMissing}
          onCreateMissing={setCreateMissing}
          duplicateAction={duplicateAction}
          onDuplicateAction={setDuplicateAction}
          existingNames={context?.existing}
        >
          {errorBanner}
          <Button variant="ghost" title={t('import.back')} onPress={() => setStep('map')} />
        </PreviewStep>
      ) : null}

      {step === 'running' ? (
        <Card style={styles.gapSm}>
          <AppText variant="h3">{t('import.importing')}</AppText>
          <ProgressBar value={progress.total ? progress.done / progress.total : 0} label={t('import.importing')} />
          <AppText variant="bodySm" tone="secondary" ltr>
            {t('import.progress', { done: progress.done, total: progress.total })}
          </AppText>
        </Card>
      ) : null}

      {step === 'done' && result ? (
        <>
          <Card style={styles.gapSm}>
            <AppText variant="h3">
              {t('import.done', { created: result.created, updated: result.updated, skipped: result.skipped })}
            </AppText>
          </Card>
          {result.error ? (
            <InlineBanner tone="danger" message={`${t('import.partial', { done: result.processed })} ${errorMessage(result.error)}`} />
          ) : null}
          <Button
            variant="secondary"
            title={t('import.pickFile')}
            onPress={() => {
              setFile(null);
              setResult(null);
              setStep('pick');
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}

function PreviewStep({
  plan,
  counts,
  missingPlaces,
  canManagePlaces,
  createMissing,
  onCreateMissing,
  duplicateAction,
  onDuplicateAction,
  existingNames,
  children,
}: {
  plan: RowPlan[];
  counts: { total: number; invalid: number; fileDuplicates: number; new: number; existing: number };
  missingPlaces: { cityName: string; areaName: string }[];
  canManagePlaces: boolean;
  createMissing: boolean;
  onCreateMissing: (value: boolean) => void;
  duplicateAction: 'skip' | 'update';
  onDuplicateAction: (value: 'skip' | 'update') => void;
  existingNames?: { id: string; fullName: string }[];
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const nameById = useMemo(() => new Map((existingNames ?? []).map((b) => [b.id, b.fullName])), [existingNames]);

  const flagged = plan.filter((entry) => entry.kind === 'invalid' || entry.kind === 'fileDuplicate' || entry.kind === 'existing');
  const issues = flagged.slice(0, PREVIEW_ISSUES).map((entry) => {
    const text =
      entry.kind === 'invalid'
        ? entry.row.errors.map((e) => t(`import.errors.${e}`)).join('، ')
        : entry.kind === 'fileDuplicate'
          ? t('import.errors.duplicateInFile', { n: entry.firstLine })
          : entry.kind === 'existing'
            ? t('import.duplicateOf', { name: nameById.get(entry.beneficiaryId) ?? '' })
            : '';
    return { key: `${entry.row.line}`, line: entry.row.line, name: entry.row.fullName, text, kind: entry.kind };
  });

  return (
    <>
      <Card style={styles.gapSm}>
        <AppText variant="h3">{t('import.preview')}</AppText>
        <View style={styles.badges}>
          <Badge tone="success" label={t('import.rowsNew', { count: counts.new })} />
          <Badge tone="ink" label={t('import.rowsExisting', { count: counts.existing })} />
          {counts.fileDuplicates > 0 ? <Badge tone="warning" label={t('import.rowsFileDuplicates', { count: counts.fileDuplicates })} /> : null}
          {counts.invalid > 0 ? <Badge tone="danger" label={t('import.rowsInvalid', { count: counts.invalid })} /> : null}
        </View>
      </Card>

      {counts.existing > 0 ? (
        <View>
          <SectionHeader title={t('import.duplicateAction')} />
          <View style={styles.badges}>
            <Chip label={t('import.skip')} selected={duplicateAction === 'skip'} onPress={() => onDuplicateAction('skip')} />
            <Chip label={t('import.update')} selected={duplicateAction === 'update'} onPress={() => onDuplicateAction('update')} />
          </View>
        </View>
      ) : null}

      {missingPlaces.length > 0 ? (
        <View>
          <SectionHeader title={t('import.missingPlaces', { count: missingPlaces.length })} />
          <Card style={styles.gapSm}>
            <AppText variant="bodySm" tone="secondary">
              {missingPlaces
                .slice(0, 12)
                .map((p) => `${p.cityName} / ${p.areaName}`)
                .join('، ')}
              {missingPlaces.length > 12 ? ' …' : ''}
            </AppText>
            {canManagePlaces ? (
              <View style={styles.badges}>
                <Chip label={t('import.createMissing')} selected={createMissing} onPress={() => onCreateMissing(!createMissing)} />
              </View>
            ) : null}
          </Card>
          {!canManagePlaces ? <InlineBanner tone="warning" message={t('import.noPlacePermission')} /> : null}
          {canManagePlaces && !createMissing ? <InlineBanner tone="warning" message={t('import.missingBlocked')} /> : null}
        </View>
      ) : null}

      {issues.length > 0 ? (
        <View>
          <SectionHeader title={t('import.errorsTitle')} />
          <Card style={styles.gapSm}>
            {issues.map((issue) => (
              <View key={issue.key} style={styles.issue}>
                <View
                  style={[
                    styles.linePill,
                    { backgroundColor: issue.kind === 'invalid' ? colors.dangerTint : colors.surfaceMuted },
                  ]}
                >
                  <AppText variant="caption" weight="semibold" tone={issue.kind === 'invalid' ? 'danger' : 'secondary'} ltr>
                    {t('import.row', { n: issue.line })}
                  </AppText>
                </View>
                <View style={styles.flex}>
                  {issue.name ? (
                    <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
                      {issue.name}
                    </AppText>
                  ) : null}
                  <AppText variant="caption" tone={issue.kind === 'invalid' ? 'danger' : 'secondary'}>
                    {issue.text}
                  </AppText>
                </View>
              </View>
            ))}
            {flagged.length > issues.length ? (
              <AppText variant="caption" tone="tertiary">
                {t('import.moreIssues', { n: flagged.length - issues.length })}
              </AppText>
            ) : null}
          </Card>
        </View>
      ) : null}

      {counts.new + counts.existing === 0 ? <InlineBanner tone="info" message={t('import.nothingToImport')} /> : null}
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  stepper: { gap: spacing[2] },
  intro: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },
  tile: { width: sizes.avatarMd, height: sizes.avatarMd, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  gapSm: { gap: spacing[2] },
  hint: { marginBottom: spacing[3] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  issue: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  linePill: { borderRadius: radii.sm, paddingHorizontal: spacing[2], paddingVertical: spacing[1] / 2 },
  flex: { flex: 1 },
});
