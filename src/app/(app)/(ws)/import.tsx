import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import { AppText, Badge, Button, Card, Chip, EmptyState, Row, Screen, Section, Select } from '@/components/ui';
import { Spacing } from '@/constants/theme';
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
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback, errorMessage } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace, useCan } from '@/providers/workspace-provider';
import { loadImportContext, readImportFile, runImport, type ImportContext, type ImportResult } from '@/services/import/api';
import { OfflineError, useConnectivity } from '@/services/sync/connectivity';

type LoadedFile = { name: string; sheetName: string; headers: string[]; rows: { line: number; cells: string[] }[] };
type Step = 'pick' | 'map' | 'preview' | 'running' | 'done';

const UNMAPPED = '__none__';
const PREVIEW_ISSUES = 30;

export default function ImportScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
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

  if (!canImport) {
    return (
      <Screen header={<AppHeader title={t('import.title')} back />}>
        <EmptyState title={t('import.noPermission')} />
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
  const errorBanner = error ? <AppText style={{ color: colors.danger, marginTop: Spacing.sm }}>{error}</AppText> : null;
  const offlineBanner = !isOnline ? (
    <AppText style={{ color: colors.warning, marginBottom: Spacing.md }}>{t('import.needsConnection')}</AppText>
  ) : null;

  return (
    <Screen header={<AppHeader title={t('import.title')} back />}>
      {offlineBanner}

      {step === 'pick' ? (
        <Card>
          <AppText>{t('import.intro')}</AppText>
          <AppText muted variant="caption" style={{ marginTop: Spacing.sm }}>
            {t('import.template')}
          </AppText>
          <Button title={t('import.pickFile')} onPress={pickFile} style={{ marginTop: Spacing.lg }} />
          {errorBanner}
        </Card>
      ) : null}

      {step === 'map' && file ? (
        <Card>
          <AppText variant="label">{t('import.fileRows', { name: file.name, count: file.rows.length })}</AppText>
          {file.sheetName ? <AppText muted variant="caption">{t('import.sheet', { name: file.sheetName })}</AppText> : null}
          <Section title={t('import.mapping')}>
            <AppText muted variant="caption" style={{ marginBottom: Spacing.md }}>
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
          </Section>
          {missing.length > 0 ? (
            <AppText style={{ color: colors.warning }}>
              {t('import.missingRequired', { fields: missing.map((f) => t(`import.fields.${f}`)).join('، ') })}
            </AppText>
          ) : null}
          {errorBanner}
          <Row wrap>
            <Button variant="secondary" title={t('import.changeFile')} onPress={pickFile} style={{ marginTop: Spacing.md }} />
            <Button
              title={t('import.next')}
              loadingTitle={t('import.loadingExisting')}
              disabled={missing.length > 0 || !isOnline}
              onPress={goPreview}
              style={{ marginTop: Spacing.md }}
            />
          </Row>
        </Card>
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
          <Row wrap>
            <Button variant="secondary" title={t('import.back')} onPress={() => setStep('map')} style={{ marginTop: Spacing.md }} />
            <Button
              title={t('import.start')}
              disabled={!isOnline || plan.counts.new + plan.counts.existing === 0}
              onPress={start}
              style={{ marginTop: Spacing.md }}
            />
          </Row>
        </PreviewStep>
      ) : null}

      {step === 'running' ? (
        <Card>
          <AppText variant="label">{t('import.importing')}</AppText>
          <AppText muted style={{ marginTop: Spacing.sm }}>
            {t('import.progress', { done: progress.done, total: progress.total })}
          </AppText>
        </Card>
      ) : null}

      {step === 'done' && result ? (
        <Card>
          <AppText variant="label">
            {t('import.done', { created: result.created, updated: result.updated, skipped: result.skipped })}
          </AppText>
          {result.error ? (
            <AppText style={{ color: colors.danger, marginTop: Spacing.sm }}>
              {t('import.partial', { done: result.processed })} {errorMessage(result.error)}
            </AppText>
          ) : null}
          <Row wrap>
            <Button
              variant="secondary"
              title={t('import.pickFile')}
              onPress={() => {
                setFile(null);
                setResult(null);
                setStep('pick');
              }}
              style={{ marginTop: Spacing.md }}
            />
            <Button title={t('common.done')} onPress={() => router.back()} style={{ marginTop: Spacing.md }} />
          </Row>
        </Card>
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
  const { colors } = useAppTheme();
  const nameById = useMemo(() => new Map((existingNames ?? []).map((b) => [b.id, b.fullName])), [existingNames]);

  const issues = plan
    .filter((entry) => entry.kind === 'invalid' || entry.kind === 'fileDuplicate' || entry.kind === 'existing')
    .slice(0, PREVIEW_ISSUES)
    .map((entry) => {
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
    <Card>
      <AppText variant="label">{t('import.preview')}</AppText>
      <Row wrap style={{ marginTop: Spacing.sm }}>
        <Badge tone="success" label={t('import.rowsNew', { count: counts.new })} />
        <Badge tone="primary" label={t('import.rowsExisting', { count: counts.existing })} />
        {counts.fileDuplicates > 0 ? <Badge tone="warning" label={t('import.rowsFileDuplicates', { count: counts.fileDuplicates })} /> : null}
        {counts.invalid > 0 ? <Badge tone="danger" label={t('import.rowsInvalid', { count: counts.invalid })} /> : null}
      </Row>

      {counts.existing > 0 ? (
        <Section title={t('import.duplicateAction')}>
          <Row wrap>
            <Chip label={t('import.skip')} selected={duplicateAction === 'skip'} onPress={() => onDuplicateAction('skip')} />
            <Chip label={t('import.update')} selected={duplicateAction === 'update'} onPress={() => onDuplicateAction('update')} />
          </Row>
        </Section>
      ) : null}

      {missingPlaces.length > 0 ? (
        <Section title={t('import.missingPlaces', { count: missingPlaces.length })}>
          <AppText muted variant="caption">
            {missingPlaces
              .slice(0, 12)
              .map((p) => `${p.cityName} / ${p.areaName}`)
              .join('، ')}
            {missingPlaces.length > 12 ? ' …' : ''}
          </AppText>
          {canManagePlaces ? (
            <Row wrap style={{ marginTop: Spacing.sm }}>
              <Chip label={t('import.createMissing')} selected={createMissing} onPress={() => onCreateMissing(!createMissing)} />
            </Row>
          ) : (
            <AppText style={{ color: colors.warning, marginTop: Spacing.sm }}>{t('import.noPlacePermission')}</AppText>
          )}
          {canManagePlaces && !createMissing ? (
            <AppText style={{ color: colors.warning, marginTop: Spacing.sm }}>{t('import.missingBlocked')}</AppText>
          ) : null}
        </Section>
      ) : null}

      {issues.length > 0 ? (
        <Section title={t('import.errorsTitle')}>
          {issues.map((issue) => (
            <AppText
              key={issue.key}
              variant="caption"
              style={{ color: issue.kind === 'invalid' ? colors.danger : colors.textSecondary, marginBottom: Spacing.xs }}
            >
              {t('import.row', { n: issue.line })}
              {issue.name ? ` · ${issue.name}` : ''}: {issue.text}
            </AppText>
          ))}
        </Section>
      ) : null}

      {counts.new + counts.existing === 0 ? <AppText muted>{t('import.nothingToImport')}</AppText> : null}
      {children}
    </Card>
  );
}
