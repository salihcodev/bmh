import { Camera, ImageIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, GroupedList, ListRow } from '@/components/ui';
import { emitActionFeedback } from '@/lib/action-feedback';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { AvatarCheckError, startAvatarUpload } from '@/services/media/avatar-upload';
import { pickImage, type PickSource } from '@/services/media/pick';
import { OUTBOX_JOBS, outbox } from '@/services/sync/outbox-runtime';
import { spacing } from '@/theme';

/**
 * Profile photo (MEDIA-06). Pick from the library or camera with a square crop, then resize,
 * compress and upload. Offline, the prepared file waits in the outbox and uploads on reconnect.
 */
export function ChangeAvatarSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [progress, setProgress] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  useEffect(() => () => abortRef.current?.(), []);
  const busy = progress !== null;

  const choose = async (source: PickSource) => {
    if (!user || busy) return;
    const picked = await pickImage(source, { square: true });
    if (picked.status === 'cancelled') return;
    if (picked.status === 'denied') {
      emitActionFeedback({ message: t(source === 'camera' ? 'profile.avatar.cameraPermission' : 'profile.avatar.libraryPermission'), kind: 'error' });
      return;
    }
    setProgress(0);
    try {
      const outcome = await startAvatarUpload(
        picked.image,
        {
          uid: user.uid,
          enqueue: (payload) => {
            outbox.enqueue(OUTBOX_JOBS.mediaUpload, payload, `${OUTBOX_JOBS.mediaUpload}:${payload.mediaId}`, payload.uid);
          },
        },
        { onProgress: setProgress, onAbort: (abort) => (abortRef.current = abort) },
      );
      if (outcome === 'uploaded') emitActionFeedback({ message: t('profile.avatar.done'), kind: 'success' });
      if (outcome === 'queued') emitActionFeedback({ message: t('profile.avatar.queued'), kind: 'info' });
      if (outcome !== 'cancelled') onClose();
    } catch (error) {
      const key =
        error instanceof AvatarCheckError
          ? { type: 'errorType', size: 'errorSize', notConfigured: 'notConfigured' }[error.code]
          : 'failed';
      emitActionFeedback({ message: t(`profile.avatar.${key}`), kind: 'error' });
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  return (
    <BottomSheet visible={visible} title={t('profile.avatar.title')} onClose={busy ? () => undefined : onClose}>
      {busy ? (
        <View style={styles.busy}>
          <AppText center tone="secondary">
            {t('manage.media.uploading', { percent: Math.round((progress ?? 0) * 100) })}
          </AppText>
          <Button compact variant="secondary" title={t('manage.media.cancel')} onPress={() => abortRef.current?.()} />
        </View>
      ) : (
        <GroupedList>
          <ListRow icon={ImageIcon} label={t('profile.avatar.library')} onPress={() => void choose('library')} />
          <ListRow icon={Camera} label={t('profile.avatar.camera')} onPress={() => void choose('camera')} />
        </GroupedList>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  busy: { gap: spacing[3], alignItems: 'center', paddingVertical: spacing[4] },
});
