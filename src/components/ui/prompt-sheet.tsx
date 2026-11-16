import { useState } from 'react';

import { useTranslation } from '@/localization';

import { AppText } from './app-text';
import { Button } from './button';
import { Field } from './field';
import { Sheet } from './sheet';

/** Small form in a bottom sheet (add city, rename area...). Remount via `key` to reset. */
export function PromptSheet({
  visible,
  title,
  fields,
  submitLabel,
  hint,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  fields: { key: string; label: string; initial?: string; multiline?: boolean; required?: boolean; max?: number }[];
  submitLabel?: string;
  hint?: string;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.initial ?? ''])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const next: Record<string, string> = {};
    for (const field of fields) {
      const value = values[field.key]?.trim() ?? '';
      if (field.required !== false && !value) next[field.key] = t('validation.required');
      else if (value.length > (field.max ?? 80)) next[field.key] = t('validation.tooLong');
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    await onSubmit(values);
  };

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {hint ? <AppText muted>{hint}</AppText> : null}
      {fields.map((field) => (
        <Field
          key={field.key}
          label={field.label}
          multiline={field.multiline}
          value={values[field.key]}
          onChangeText={(text) => setValues((current) => ({ ...current, [field.key]: text }))}
          error={errors[field.key]}
        />
      ))}
      <Button title={submitLabel ?? t('common.save')} onPress={submit} />
    </Sheet>
  );
}
