import { zodResolver } from '@hookform/resolvers/zod';
import { randomUUID } from 'expo-crypto';
import { Plus, Star, Trash2 } from 'lucide-react-native';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Field, Section, Select } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { beneficiarySchema, type BeneficiaryInput } from '@/domain/beneficiary';
import { MAX_PHONES } from '@/domain/phone';
import { usePlaces } from '@/features/places/use-places';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTranslation } from '@/localization';

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

export function BeneficiaryForm({
  wid,
  defaultValues,
  submitLabel,
  onSubmit,
}: {
  wid: string;
  defaultValues: BeneficiaryInput;
  submitLabel: string;
  onSubmit: (value: BeneficiaryInput, place: { cityName: string; areaName: string }) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const places = usePlaces(wid);
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

  const submit = handleSubmit((value) => {
    const city = places.cityById.get(value.cityId);
    const area = places.areaById.get(value.areaId);
    onSubmit(value, { cityName: city?.name ?? '', areaName: area?.name ?? '' });
  });

  const makePrimary = (index: number) => {
    phoneValues.forEach((_, i) => setValue(`phones.${i}.isPrimary`, i === index));
  };

  return (
    <View>
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
              variant="ghost"
              title={t('beneficiaries.addPhone')}
              icon={<Plus size={18} />}
              onPress={() =>
                phones.append({ id: randomUUID(), raw: '', label: '', isPrimary: phones.fields.length === 0 })
              }
            />
          ) : null
        }
      >
        <Card>
          {phones.fields.length === 0 ? <AppText muted>{t('beneficiaries.noPhones')}</AppText> : null}
          {phones.fields.map((item, index) => {
            const primary = phoneValues[index]?.isPrimary;
            return (
              <View key={item.id} style={[styles.phone, { borderBottomColor: colors.border }]}>
                <Controller
                  control={control}
                  name={`phones.${index}.raw`}
                  render={({ field }) => (
                    <Field
                      label={t('beneficiaries.phoneNumber')}
                      keyboardType="phone-pad"
                      ltr
                      placeholder="01xxxxxxxxx"
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
                    <Star size={18} color={primary ? colors.warning : colors.textSecondary} fill={primary ? colors.warning : 'none'} />
                    <AppText variant="caption">{primary ? t('beneficiaries.primary') : t('beneficiaries.makePrimary')}</AppText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('common.remove')}
                    hitSlop={8}
                    onPress={() => {
                      phones.remove(index);
                      if (primary && phoneValues.length > 1) setValue('phones.0.isPrimary', true);
                    }}
                  >
                    <Trash2 size={20} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            );
          })}
          {errors.phones?.message ? (
            <AppText style={{ color: colors.danger }}>{t(errors.phones.message)}</AppText>
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

      <Button title={submitLabel} onPress={submit} style={{ marginTop: Spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  phone: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: Spacing.sm, marginBottom: Spacing.md },
  phoneActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: 44 },
});
