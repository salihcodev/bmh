import { Timestamp } from '@react-native-firebase/firestore';
import { randomUUID } from 'expo-crypto';
import { Crosshair, MapPin, Navigation, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Field, Row, Section, Sheet } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { MAX_PINS } from '@/domain/beneficiary';
import { formatCoords, mapsUrl, round } from '@/domain/maps';
import type { Beneficiary, MapPin as Pin } from '@/domain/types';
import { useAppTheme } from '@/hooks/use-app-theme';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace } from '@/providers/workspace-provider';
import { saveMapPins } from '@/services/beneficiaries/api';
import { currentCoords, resolveCoordinates } from '@/services/location';

export function openInMaps(pin: { lat: number; lng: number }) {
  void Linking.openURL(mapsUrl(pin));
}

export function PinsSection({ wid, beneficiary, canEdit }: { wid: string; beneficiary: Beneficiary; canEdit: boolean }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { actor } = useActiveWorkspace();
  const [editing, setEditing] = useState<Pin | 'new' | null>(null);
  const pins = beneficiary.mapPins ?? [];

  const remove = (pin: Pin) =>
    Alert.alert(t('pins.delete'), t('pins.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          saveMapPins(wid, beneficiary, pins.filter((p) => p.id !== pin.id), { type: 'pin_removed', pinId: pin.id }, actor),
      },
    ]);

  return (
    <Section
      title={t('beneficiaries.pins')}
      action={
        canEdit && pins.length < MAX_PINS ? (
          <Button compact variant="ghost" title={t('pins.add')} icon={<Plus size={16} />} onPress={() => setEditing('new')} />
        ) : null
      }
    >
      <Card>
        {pins.length === 0 ? <AppText muted>{t('pins.none')}</AppText> : null}
        {pins.map((pin) => (
          <View key={pin.id} style={[styles.pin, { borderBottomColor: colors.border }]}>
            <MapPin size={20} color={colors.accent} />
            <View style={styles.flex}>
              <AppText variant="label">{pin.label || formatCoords(pin)}</AppText>
              {pin.label ? (
                <AppText variant="caption" muted ltr>
                  {formatCoords(pin)}
                </AppText>
              ) : null}
              {pin.description ? (
                <AppText variant="caption" muted>
                  {pin.description}
                </AppText>
              ) : null}
            </View>
            <Button compact variant="secondary" title={t('pins.open')} icon={<Navigation size={16} />} onPress={() => openInMaps(pin)} />
            {canEdit ? (
              <>
                <Button compact variant="ghost" title="" accessibilityLabel={t('pins.edit')} icon={<Pencil size={16} />} onPress={() => setEditing(pin)} />
                <Button compact variant="danger" title="" accessibilityLabel={t('pins.delete')} icon={<Trash2 size={16} />} onPress={() => remove(pin)} />
              </>
            ) : null}
          </View>
        ))}
      </Card>
      <PinSheet
        key={editing === 'new' ? 'new' : (editing?.id ?? 'none')}
        visible={editing !== null}
        pin={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          const exists = pins.some((p) => p.id === next.id);
          const list = exists ? pins.map((p) => (p.id === next.id ? next : p)) : [...pins, next];
          saveMapPins(wid, beneficiary, list, { type: exists ? 'pin_updated' : 'pin_added', pinId: next.id }, actor);
          emitActionFeedback({ message: t('pins.saved'), kind: 'success' });
          setEditing(null);
        }}
      />
    </Section>
  );
}

function PinSheet({
  visible,
  pin,
  onClose,
  onSave,
}: {
  visible: boolean;
  pin: Pin | null;
  onClose: () => void;
  onSave: (pin: Pin) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { actor } = useActiveWorkspace();
  const [input, setInput] = useState(pin ? formatCoords(pin) : '');
  const [label, setLabel] = useState(pin?.label ?? '');
  const [description, setDescription] = useState(pin?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const useCurrent = async () => {
    setError(null);
    try {
      const coords = await currentCoords();
      if (coords === 'denied') {
        setError(t('pins.permissionDenied'));
        return;
      }
      setInput(formatCoords(coords));
    } catch {
      setError(t('errors.generic'));
    }
  };

  const save = async () => {
    const parsed = await resolveCoordinates(input);
    if (!parsed.ok) {
      setError(t(parsed.reason === 'shortLink' ? 'common.connectToContinue' : 'validation.coordsInvalid'));
      return;
    }
    const now = Timestamp.now();
    onSave({
      id: pin?.id ?? randomUUID(),
      lat: round(parsed.coords.lat),
      lng: round(parsed.coords.lng),
      label: label.trim() || null,
      description: description.trim() || null,
      createdAt: pin?.createdAt ?? now,
      updatedAt: now,
      createdBy: pin?.createdBy ?? actor.uid,
    });
  };

  return (
    <Sheet visible={visible} title={pin ? t('pins.edit') : t('pins.add')} onClose={onClose}>
      <Field
        label={t('pins.input')}
        hint={t('pins.inputHint')}
        ltr
        autoCorrect={false}
        value={input}
        onChangeText={(text) => {
          setInput(text);
          setError(null);
        }}
      />
      <Row>
        <Button
          compact
          variant="secondary"
          title={t('pins.useCurrent')}
          loadingTitle={t('pins.locating')}
          icon={<Crosshair size={16} />}
          onPress={useCurrent}
        />
      </Row>
      <Field label={t('pins.label')} value={label} onChangeText={setLabel} />
      <Field label={t('pins.description')} multiline value={description} onChangeText={setDescription} />
      {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}
      <Button title={t('common.save')} onPress={save} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
