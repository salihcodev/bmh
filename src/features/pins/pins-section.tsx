import { Timestamp } from '@react-native-firebase/firestore';
import { randomUUID } from 'expo-crypto';
import { Crosshair, MapPin, Navigation, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Card, ConfirmDialog, Field, IconButton, InlineBanner, SectionHeader } from '@/components/ui';
import { MAX_PINS } from '@/domain/beneficiary';
import { formatCoords, mapsUrl, round } from '@/domain/maps';
import type { Beneficiary, MapPin as Pin } from '@/domain/types';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useActiveWorkspace } from '@/providers/workspace-provider';
import { saveMapPins } from '@/services/beneficiaries/api';
import { currentCoords, resolveCoordinates } from '@/services/location';
import { iconStroke, radii, sizes, spacing, useTheme } from '@/theme';

export function openInMaps(pin: { lat: number; lng: number }) {
  void Linking.openURL(mapsUrl(pin));
}

export function PinsSection({ wid, beneficiary, canEdit }: { wid: string; beneficiary: Beneficiary; canEdit: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { actor } = useActiveWorkspace();
  const [editing, setEditing] = useState<Pin | 'new' | null>(null);
  const [removing, setRemoving] = useState<Pin | null>(null);
  const pins = beneficiary.mapPins ?? [];

  return (
    <View>
      <SectionHeader
        title={t('beneficiaries.pins')}
        action={
          canEdit && pins.length < MAX_PINS ? (
            <Button compact fullWidth={false} variant="ghost" title={t('pins.add')} icon={<Plus />} onPress={() => setEditing('new')} />
          ) : null
        }
      />
      <Card style={styles.group}>
        {pins.length === 0 ? (
          <AppText variant="bodySm" tone="secondary">
            {t('pins.none')}
          </AppText>
        ) : null}
        {pins.map((pin, index) => (
          <View
            key={pin.id}
            style={[styles.pin, index > 0 && { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <View style={[styles.tile, { backgroundColor: colors.accent }]}>
              <MapPin size={sizes.iconSm} color={colors.onAccent} strokeWidth={iconStroke} />
            </View>
            <View style={styles.flex}>
              <AppText variant="body" weight="semibold" numberOfLines={1}>
                {pin.label || formatCoords(pin)}
              </AppText>
              {pin.label ? (
                <AppText variant="caption" tone="secondary" ltr>
                  {formatCoords(pin)}
                </AppText>
              ) : null}
              {pin.description ? (
                <AppText variant="caption" tone="secondary">
                  {pin.description}
                </AppText>
              ) : null}
            </View>
            <IconButton icon={Navigation} label={t('pins.open')} onPress={() => openInMaps(pin)} />
            {canEdit ? (
              <>
                <IconButton icon={Pencil} variant="ghost" label={t('pins.edit')} onPress={() => setEditing(pin)} />
                <IconButton icon={Trash2} variant="ghost" label={t('pins.delete')} onPress={() => setRemoving(pin)} />
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
      <ConfirmDialog
        visible={removing !== null}
        title={t('pins.delete')}
        message={t('pins.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            saveMapPins(wid, beneficiary, pins.filter((p) => p.id !== removing.id), { type: 'pin_removed', pinId: removing.id }, actor);
          }
          setRemoving(null);
        }}
      />
    </View>
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
    <BottomSheet
      visible={visible}
      title={pin ? t('pins.edit') : t('pins.add')}
      onClose={onClose}
      footer={<Button title={t('common.save')} onPress={save} />}
    >
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
      <Button
        compact
        fullWidth={false}
        variant="secondary"
        title={t('pins.useCurrent')}
        loadingTitle={t('pins.locating')}
        icon={<Crosshair />}
        onPress={useCurrent}
      />
      <Field label={t('pins.label')} value={label} onChangeText={setLabel} />
      <Field label={t('pins.description')} multiline value={description} onChangeText={setDescription} />
      {error ? <InlineBanner tone="danger" message={error} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing[1] },
  flex: { flex: 1 },
  tile: { width: sizes.iconTile, height: sizes.iconTile, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  pin: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
});
