import { StyleSheet, View } from 'react-native';

import { BottomSheet, Button, InlineBanner, useToast } from '@/components/ui';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTranslation } from '@/localization';
import { useMediaAssets } from '@/services/admin/use-admin';
import type { MediaEntity } from '@/services/media/groups';
import { presetFor } from '@/services/media/upload';
import { screenPadding, spacing } from '@/theme';

import { MediaGrid } from './media-grid';
import { useAdminAction } from './use-admin-action';
import { useUploader } from './use-uploader';

/**
 * Choose an image for a form field: reuse one from the library, or upload a new one (resized and
 * compressed first). Returns the Cloudinary public ID; the form stores only that.
 */
export function MediaPickerSheet({
  visible,
  title,
  entity,
  lang = null,
  entityId = null,
  selected,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  entity: MediaEntity;
  lang?: 'ar' | 'en' | null;
  /** The document the image is for, when it already exists. Recorded with the upload. */
  entityId?: string | null;
  selected: string | null;
  onClose: () => void;
  onPick: (publicId: string | null) => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { can } = useCurrentUser();
  const { actor } = useAdminAction();
  const uploader = useUploader(actor);
  const media = useMediaAssets(entity, false, visible);
  const configured = presetFor(entity) !== null;
  const uploading = uploader.state.phase === 'uploading';

  const upload = async () => {
    const done = await uploader.pickAndUpload({ entity, entityId, lang });
    if (done) {
      showToast({ kind: 'success', message: t('manage.media.uploaded') });
      uploader.reset();
      onPick(done.result.publicId);
    }
  };

  const close = () => {
    if (uploading) return;
    uploader.reset();
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={close}
      footer={
        <View style={styles.footer}>
          {uploader.state.phase === 'error' ? <InlineBanner tone="danger" message={uploader.state.message} /> : null}
          {!configured ? <InlineBanner tone="warning" message={t('manage.media.notConfigured')} /> : null}
          {configured && can('media.upload') ? (
            uploading ? (
              <Button
                variant="secondary"
                title={`${t('manage.media.uploading', { percent: Math.round((uploader.state.phase === 'uploading' ? uploader.state.progress : 0) * 100) })} · ${t('manage.media.cancel')}`}
                onPress={uploader.cancel}
              />
            ) : (
              <Button variant="lime" title={t('manage.media.uploadNew')} onPress={() => void upload()} />
            )
          ) : null}
          {selected && !uploading ? <Button title={t('manage.banners.clearImage')} variant="ghost" onPress={() => onPick(null)} /> : null}
        </View>
      }
    >
      <View style={styles.picker}>
        <MediaGrid media={media} selectedPublicId={selected} onSelect={(asset) => onPick(asset.publicId)} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing[2] },
  picker: { height: 420, marginHorizontal: -screenPadding },
});
