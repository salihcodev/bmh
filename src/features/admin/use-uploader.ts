import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/localization';
import { recordUpload, removeMedia } from '@/services/admin/admin-writes';
import { newId, refs, type Actor } from '@/services/firebase/refs';
import type { MediaEntity } from '@/services/media/groups';
import { pickImage, type PickSource } from '@/services/media/pick';
import { prepareImage, removeQueuedFile } from '@/services/media/prepare';
import {
  canUndo,
  checkUpload,
  deleteByToken,
  presetFor,
  preparedFits,
  uploadImage,
  UploadError,
  type PickedImage,
  type UploadResult,
} from '@/services/media/upload';
import { checkOnline } from '@/services/sync/connectivity';

export type UploadState =
  | { phase: 'idle' }
  | { phase: 'picked'; image: PickedImage; warning: string | null }
  | { phase: 'uploading'; image: PickedImage; progress: number }
  | { phase: 'done'; image: PickedImage; result: UploadResult; mediaId: string; uploadedAt: number }
  | { phase: 'error'; image: PickedImage | null; message: string };

export type UploadTarget = {
  entity: MediaEntity;
  /** The document the image belongs to (banner id, news id, ...) when it exists already. */
  entityId?: string | null;
  lang?: 'ar' | 'en' | null;
  label?: string;
  workspaceId?: string | null;
};

const CHECK_KEYS = { type: 'errorType', size: 'errorSize', notConfigured: 'notConfigured' } as const;

/**
 * Staff upload flow: pick, validate, resize and compress, upload with progress and cancel, record
 * in `media`, and undo inside the Cloudinary delete-token window. Online only (checked first);
 * only the user's own avatar is queued, through the outbox (see avatar-upload.ts).
 */
export function useUploader(actor: Actor) {
  const { t } = useTranslation();
  const [state, setState] = useState<UploadState>({ phase: 'idle' });
  const abortRef = useRef<(() => void) | null>(null);
  useEffect(() => () => abortRef.current?.(), []);

  /** Opens the picker and validates the choice. Null when cancelled, denied or rejected (state shows why). */
  const choose = useCallback(
    async (entity: MediaEntity, source: PickSource): Promise<{ image: PickedImage; warning: string | null } | null> => {
      const picked = await pickImage(source);
      if (picked.status === 'cancelled') return null;
      if (picked.status === 'denied') {
        setState({ phase: 'error', image: null, message: t('manage.media.permission') });
        return null;
      }
      const image = picked.image;
      // The original's size is irrelevant: the resized file is what gets uploaded and size-checked.
      const check = checkUpload({ ...image, fileSize: null }, entity, presetFor(entity));
      if (!check.ok) {
        setState({ phase: 'error', image, message: t(`manage.media.${CHECK_KEYS[check.error]}`) });
        return null;
      }
      return { image, warning: check.warning ? t('manage.media.warnRatio') : null };
    },
    [t],
  );

  const pick = useCallback(
    async (entity: MediaEntity, source: PickSource = 'library') => {
      const chosen = await choose(entity, source);
      if (chosen) setState({ phase: 'picked', image: chosen.image, warning: chosen.warning });
    },
    [choose],
  );

  const run = useCallback(
    async (image: PickedImage, target: UploadTarget): Promise<{ mediaId: string; result: UploadResult } | null> => {
      if (!(await checkOnline())) {
        setState({ phase: 'error', image, message: t('manage.offline') });
        return null;
      }
      const check = checkUpload({ ...image, fileSize: null }, target.entity, presetFor(target.entity));
      if (!check.ok) return null;
      setState({ phase: 'uploading', image, progress: 0 });
      let preparedUri: string | null = null;
      try {
        const prepared = await prepareImage(image, target.entity, check.mimeType);
        preparedUri = prepared.uri;
        if (!preparedFits(prepared.bytes)) {
          setState({ phase: 'error', image, message: t('manage.media.errorSize') });
          return null;
        }
        const mediaId = newId(refs.media());
        const job = uploadImage(
          { uri: prepared.uri, mimeType: prepared.mimeType, name: prepared.fileName },
          {
            entity: target.entity,
            mediaId,
            entityId: target.entityId ?? null,
            ownerId: actor.uid,
            lang: target.lang ?? null,
            onProgress: (progress) => setState((s) => (s.phase === 'uploading' ? { ...s, progress } : s)),
          },
        );
        abortRef.current = job.abort;
        const result = await job.promise;
        await recordUpload(actor, {
          id: mediaId,
          result,
          entity: target.entity,
          entityId: target.entityId ?? mediaId,
          ownerId: actor.uid,
          workspaceId: target.workspaceId ?? null,
          lang: target.lang ?? null,
          label: target.label ?? '',
          preset: presetFor(target.entity) ?? '',
        });
        setState({ phase: 'done', image, result, mediaId, uploadedAt: Date.now() });
        return { mediaId, result };
      } catch (error) {
        if (error instanceof UploadError && error.reason === 'aborted') setState({ phase: 'picked', image, warning: null });
        else setState({ phase: 'error', image, message: t('manage.media.failed', { message: (error as Error).message }) });
        return null;
      } finally {
        abortRef.current = null;
        if (preparedUri) removeQueuedFile(preparedUri);
      }
    },
    [actor, t],
  );

  /** Upload the image chosen with `pick` (the two-step flow of the media library). */
  const upload = useCallback(
    async (target: UploadTarget) => (state.phase === 'picked' ? run(state.image, target) : null),
    [run, state],
  );

  /** Pick and upload in one go (image fields in forms). Resolves with the new media, or null. */
  const pickAndUpload = useCallback(
    async (target: UploadTarget, source: PickSource = 'library') => {
      const chosen = await choose(target.entity, source);
      return chosen ? run(chosen.image, target) : null;
    },
    [choose, run],
  );

  const cancel = useCallback(() => abortRef.current?.(), []);

  /** Returns 'undone' | 'expired' | 'failed'. On expiry the caller offers Remove (leaves an orphan note). */
  const undo = useCallback(async (): Promise<'undone' | 'expired' | 'failed'> => {
    if (state.phase !== 'done') return 'failed';
    if (!canUndo(state.uploadedAt, Date.now(), state.result.deleteToken)) return 'expired';
    try {
      await deleteByToken(state.result.deleteToken!);
      await removeMedia(actor, { id: state.mediaId, publicId: state.result.publicId }, true);
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

  return { state, pick, upload, pickAndUpload, cancel, undo, reset };
}
