import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { fitWithin, outputFormat, uploadSpec, type MediaEntity } from './groups';
import type { PickedImage } from './upload-rules';

// Native side of the upload pipeline (MEDIA-04): resize and compress before the file leaves the
// phone, and park a prepared file in app storage so the outbox can upload it later. The pure
// decisions (size, format) live in groups.ts and are unit tested there.

export type PreparedImage = {
  uri: string;
  mimeType: 'image/jpeg' | 'image/png';
  fileName: string;
  width: number;
  height: number;
  /** Size of the re-encoded file, 0 when it could not be read. */
  bytes: number;
};

/** Resizes to the group's longest side (never upscales) and re-encodes. Always returns a new file. */
export async function prepareImage(image: PickedImage, entity: MediaEntity, sourceMime: string): Promise<PreparedImage> {
  const spec = uploadSpec(entity);
  const format = outputFormat(entity, sourceMime);
  const context = ImageManipulator.manipulate(image.uri);
  try {
    const size = image.width && image.height ? fitWithin(image.width, image.height, spec.maxSide) : null;
    if (size) context.resize(size);
    const ref = await context.renderAsync();
    try {
      const saved = await ref.saveAsync({
        format: format === 'png' ? SaveFormat.PNG : SaveFormat.JPEG,
        compress: spec.quality,
      });
      const ext = format === 'png' ? 'png' : 'jpg';
      return {
        uri: saved.uri,
        mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
        fileName: `upload.${ext}`,
        width: saved.width,
        height: saved.height,
        bytes: fileBytes(saved.uri),
      };
    } finally {
      ref.release();
    }
  } finally {
    context.release();
  }
}

function fileBytes(uri: string): number {
  try {
    return new File(uri).size;
  } catch {
    return 0;
  }
}

const QUEUE_DIR = 'media-queue';

/** Moves a prepared file into app storage (safe from cache cleaning) and returns its new URI. */
export async function persistForQueue(uri: string, mediaId: string, mimeType: string): Promise<string> {
  const dir = new Directory(Paths.document, QUEUE_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `${mediaId}.${mimeType === 'image/png' ? 'png' : 'jpg'}`);
  await new File(uri).move(target, { overwrite: true });
  return target.uri;
}

/** Deletes queued files no outbox job points at (sign-out, dismissed jobs). Safe to call at launch. */
export function sweepQueuedFiles(keepUris: readonly string[]): void {
  try {
    const dir = new Directory(Paths.document, QUEUE_DIR);
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      if (entry instanceof File && !keepUris.includes(entry.uri)) entry.delete();
    }
  } catch {
    // Cleaning is best effort; a leftover file costs a few KB.
  }
}

/** Best-effort removal of a queued file. A missing file is fine. */
export function removeQueuedFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The file is already gone or unreadable; nothing to clean.
  }
}
