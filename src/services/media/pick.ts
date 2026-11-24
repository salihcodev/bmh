import * as ImagePicker from 'expo-image-picker';

import type { PickedImage } from './upload-rules';

export type PickSource = 'library' | 'camera';
export type PickResult = { status: 'ok'; image: PickedImage } | { status: 'cancelled' } | { status: 'denied' };

/**
 * One wrapper over the system picker and camera. `square` opens the crop step at 1:1 (avatars);
 * the file is still resized and re-encoded afterwards by `prepareImage`.
 */
export async function pickImage(source: PickSource, options: { square?: boolean } = {}): Promise<PickResult> {
  const permission =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  const config: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: false,
    ...(options.square ? { allowsEditing: true, aspect: [1, 1] as [number, number] } : {}),
  };
  const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(config) : await ImagePicker.launchImageLibraryAsync(config);
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return { status: 'cancelled' };
  return {
    status: 'ok',
    image: {
      uri: asset.uri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
    },
  };
}
