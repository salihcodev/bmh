import { zodResolver } from '@hookform/resolvers/zod';
import { randomUUID } from 'expo-crypto';
import { Plus, Star, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Field, Screen, Section, Select } from '@/components/ui';
import { beneficiarySchema, type BeneficiaryInput } from '@/domain/beneficiary';
import { MAX_PHONES } from '@/domain/phone';
import { usePlaces } from '@/features/places/use-places';
import { useTranslation } from '@/localization';
import { iconStroke, sizes, spacing, useTheme } from '@/theme';

export function emptyBeneficiary(preset: { cityId?: string; areaId?: string } = {}): BeneficiaryInput {
  return {
    fullName: '',
    householdCount: '1',
    cityId: preset.cityId ?? '',
    areaId: preset.areaId ?? '',
    residentialAddress: '',
    pickupLocation: '',
    notes: '',
    phones: [{ id: randomUUID(), raw: '', label: '', isPrimary: true }],
  };
}

/** Full-screen form: grouped cards, sheet pickers for city/area and a sticky save bar. */
export function BeneficiaryForm({
  wid,
  header,
  defaultValues,
  submitLabel,
  onSubmit,
}: {
  wid: string;
  header: ReactNode;
  defaultValues: BeneficiaryInput;
  submitLabel: string;
  onSubmit: (value: BeneficiaryInput, place: { cityName: string; areaName: string }) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const places = usePlaces(wid);
  const [submitting, setSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<BeneficiaryInput>({ resolver: zodResolver(beneficiarySchema), defaultValues });
  const phones = useFieldArray({ control, name: 'phones' });
  const cityId = useWatch({ control, name: 'cityId' });
  const phoneValues = useWatch({ control, name: 'phones' });

  const tr = (message?: string) => (message ? t(message) : undefined);

  const submit = handleSubmit(async (value) => {
    const city = places.cityById.get(value.cityId);
    const area = places.areaById.get(value.areaId);
    setSubmitting(true);
    try {
      await onSubmit(value, { cityName: city?.name ?? '', areaName: area?.name ?? '' });
    } finally {
      setSubmitting(false);
    }
  });

  const makePrimary = (index: number) => {
    phoneValues.forEach((_, i) => setValue(`phones.${i}.isPrimary`, i === index));
  };

  return (
    <Screen
      header={header}
      contentStyle={styles.content}
      footer={<Button title={submitLabel} loading={submitting} disabled={submitting} onPress={submit} />}
    >
      <Section title={t('beneficiaries.personal')}>
        <Card>
          <Controller
            control={control}
            name="fullName"
            render={({ field }) => (
              <Field
                label={t('beneficiaries.fullName')}
                autoCapitalize="words"
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={tr(errors.fullName?.message)}
              />
            )}
          />
          <Controller
            control={control}
            name="householdCount"
            render={({ field }) => (
              <Field
                label={t('beneficiaries.householdCount')}
                keyboardType="number-pad"
                ltr
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={tr(errors.householdCount?.message)}
              />
            )}
          />
          <Controller
            control={control}
            name="cityId"
            render={({ field }) => (
              <Select
                label={t('beneficiaries.city')}
                placeholder={t('cities.selectCity')}
                value={field.value}
                options={places.activeCities.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(value) => {
                  field.onChange(value);
                  setValue('areaId', '');
                }}
                error={tr(errors.cityId?.message)}
              />
            )}
          />
          <Controller
            control={control}
            name="areaId"
            render={({ field }) => (
              <Select
                label={t('beneficiaries.area')}
                placeholder={t('cities.selectArea')}
                disabled={!cityId}
                value={field.value}
                options={places.areasOf(cityId).map((a) => ({ value: a.id, label: a.name }))}
                onChange={field.onChange}
                error={tr(errors.areaId?.message)}
              />
            )}
          />
        </Card>
      </Section>

      <Section
        title={t('beneficiaries.phones')}
        action={
          phones.fields.length < MAX_PHONES ? (
            <Button
              compact
              fullWidth={false}
              variant="ghost"
              title={t('beneficiaries.addPhone')}
              icon={<Plus />}
              onPress={() =>
                phones.append({ id: randomUUID(), raw: '', label: '', isPrimary: phones.fields.length === 0 })
              }
            />
          ) : null
        }
      >
        <Card>
          {phones.fields.length === 0 ? (
            <AppText variant="bodySm" tone="secondary">
              {t('beneficiaries.noPhones')}
            </AppText>
          ) : null}
          {phones.fields.map((item, index) => {
            const primary = phoneValues[index]?.isPrimary;
            const last = index === phones.fields.length - 1;
            return (
              <View
                key={item.id}
                style={[styles.phone, !last && { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}
              >
                <Controller
                  control={control}
                  name={`phones.${index}.raw`}
                  render={({ field }) => (
                    <Field
                      label={t('beneficiaries.phoneNumber')}
                      keyboardType="phone-pad"
                      ltr
                      placeholder={t('beneficiaries.phonePlaceholder')}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      error={tr(errors.phones?.[index]?.raw?.message)}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`phones.${index}.label`}
                  render={({ field }) => (
                    <Field
                      label={t('beneficiaries.phoneLabel')}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                    />
                  )}
                />
                <View style={styles.phoneActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: primary }}
                    onPress={() => makePrimary(index)}
                    style={styles.primary}
                    hitSlop={8}
                  >
                    <Star
                      size={sizes.iconSm}
                      strokeWidth={iconStroke}
                      color={primary ? colors.textPrimary : colors.textSecondary}
                      fill={primary ? colors.accent : 'none'}
                    />
                    <AppText variant="caption" tone={primary ? 'primary' : 'secondary'}>
                      {primary ? t('beneficiaries.primary') : t('beneficiaries.makePrimary')}
                    </AppText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('common.remove')}
                    hitSlop={8}
                    style={styles.remove}
                    onPress={() => {
                      phones.remove(index);
                      if (primary && phoneValues.length > 1) setValue('phones.0.isPrimary', true);
                    }}
                  >
                    <Trash2 size={sizes.icon} strokeWidth={iconStroke} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            );
          })}
          {errors.phones?.message ? (
            <AppText variant="bodySm" tone="danger">
              {t(errors.phones.message)}
            </AppText>
          ) : null}
        </Card>
      </Section>

      <Section title={t('beneficiaries.locations')}>
        <Card>
          <Controller
            control={control}
            name="residentialAddress"
            render={({ field }) => (
              <Field
                label={t('beneficiaries.residentialAddress')}
                multiline
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={tr(errors.residentialAddress?.message)}
              />
            )}
          />
          <Controller
            control={control}
            name="pickupLocation"
            render={({ field }) => (
              <Field
                label={t('beneficiaries.pickupLocation')}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={tr(errors.pickupLocation?.message)}
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <Field
                label={t('beneficiaries.notes')}
                multiline
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={tr(errors.notes?.message)}
              />
            )}
          />
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[2] },
  phone: { paddingBottom: spacing[2], marginBottom: spacing[4] },
  phoneActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primary: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: sizes.iconButton },
  remove: { minHeight: sizes.iconButton, minWidth: sizes.iconButton, alignItems: 'center', justifyContent: 'center' },
});
