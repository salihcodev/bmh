import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';

import { env } from '@/config/env';
import { useTranslation } from '@/localization';
import { recordUpload, setMediaArchived } from '@/services/admin/admin-writes';
import type { Actor } from '@/services/firebase/refs';
import {
  canUndo,
  checkUpload,
  deleteByToken,
  uploadImage,
  UploadError,
  type MediaKind,
  type PickedImage,
  type UploadResult,
} from '@/services/media/upload';
import { checkOnline } from '@/services/sync/connectivity';

export type UploadState =
  | { phase: 'idle' }
  | { phase: 'picked'; image: PickedImage; warning: string | null }
  | { phase: 'uploading'; image: PickedImage; progress: number }
  | { phase: 'done'; image: PickedImage; result: UploadResult; assetId: string; uploadedAt: number }
  | { phase: 'error'; image: PickedImage | null; message: string };

/** Pick, validate, upload (with progress and cancel), record in mediaAssets, and undo within the token window. */
export function useUploader(actor: Actor) {
  const { t } = useTranslation();
  const [state, setState] = useState<UploadState>({ phase: 'idle' });
  const abortRef = useRef<(() => void) | null>(null);
  useEffect(() => () => abortRef.current?.(), []);

  const pick = useCallback(
    async (kind: MediaKind) => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setState({ phase: 'error', image: null, message: t('manage.media.permission') });
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
      const asset = picked.canceled ? null : picked.assets[0];
      if (!asset) return;
      const image: PickedImage = {
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
        width: asset.width,
        height: asset.height,
      };
      const check = checkUpload(image, kind, env.cloudinaryUploadPreset);
      if (!check.ok) {
        const key = { type: 'errorType', size: 'errorSize', notConfigured: 'notConfigured' }[check.error];
        setState({ phase: 'error', image, message: t(`manage.media.${key}`) });
        return;
      }
      setState({ phase: 'picked', image, warning: check.warning ? t('manage.media.warnRatio') : null });
    },
    [t],
  );

  const upload = useCallback(
    async (kind: MediaKind, lang: 'ar' | 'en' | null, label: string) => {
      if (state.phase !== 'picked') return;
      const image = state.image;
      if (!(await checkOnline())) {
        setState({ phase: 'error', image, message: t('manage.offline') });
        return;
      }
      const check = checkUpload(image, kind, env.cloudinaryUploadPreset);
      if (!check.ok) return;
      setState({ phase: 'uploading', image, progress: 0 });
      const ext = check.mimeType.split('/')[1];
      const job = uploadImage(
        { uri: image.uri, mimeType: check.mimeType, name: image.fileName || `upload.${ext}` },
        { kind, lang, onProgress: (progress) => setState((s) => (s.phase === 'uploading' ? { ...s, progress } : s)) },
      );
      abortRef.current = job.abort;
      try {
        const result = await job.promise;
        const assetId = await recordUpload(actor, result, kind, lang, label);
        setState({ phase: 'done', image, result, assetId, uploadedAt: Date.now() });
      } catch (error) {
        if (error instanceof UploadError && error.reason === 'aborted') setState({ phase: 'picked', image, warning: null });
        else setState({ phase: 'error', image, message: t('manage.media.failed', { message: (error as Error).message }) });
      } finally {
        abortRef.current = null;
      }
    },
    [actor, state, t],
  );

  const cancel = useCallback(() => abortRef.current?.(), []);

  /** Returns 'undone' | 'expired' | 'failed'. On expiry or failure the caller offers Archive instead. */
  const undo = useCallback(async (): Promise<'undone' | 'expired' | 'failed'> => {
    if (state.phase !== 'done') return 'failed';
    if (!canUndo(state.uploadedAt, Date.now(), state.result.deleteToken)) return 'expired';
    try {
      await deleteByToken(state.result.deleteToken!);
      await setMediaArchived(actor, state.assetId, true, 'media_undone');
      setState({ phase: 'idle' });
      return 'undone';
    } catch {
      return 'failed';
    }
  }, [actor, state]);

  const reset = useCallback(() => {
    abortRef.current?.();
    setState({ phase: 'idle' });
  }, []);

  return { state, pick, upload, cancel, undo, reset, configured: !!env.cloudinaryUploadPreset };
}
