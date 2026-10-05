import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { CLOUDINARY_API, CLOUDINARY_UPLOAD_PRESET } from '@/lib/cloudinary';

export type ImageSource = 'library' | 'camera';

/// Longest edge, in px, of an uploaded note image. Phone photos are
/// 4000px+; 1600 stays sharp on any phone screen at a fraction of the size.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

/// Cloudinary delete tokens expire 10 minutes after upload.
const DELETE_TOKEN_TTL_MS = 9 * 60 * 1000;

/// A stalled upload gives up after this long instead of spinning forever.
const UPLOAD_TIMEOUT_MS = 60 * 1000;

export class ImagePermissionError extends Error {}

/// Cloudinary rejected the upload; `message` is its reason (e.g. a preset
/// that isn't unsigned, or a disallowed format), safe to show the admin.
export class ImageUploadError extends Error {}

/// Delete tokens of this app session's uploads, by URL. Unsigned clients
/// can't delete arbitrary images (that needs the API secret), only ones
/// uploaded in the last 10 minutes, with the token from the upload response.
const deleteTokens = new Map<string, { token: string; expiresAt: number }>();

/// Note images on Cloudinary, uploaded through an unsigned preset (see
/// `lib/cloudinary.ts`). A note's Delta holds each image's https URL — that
/// URL is the only reference, so the Delta is the single source of truth
/// for which images a note uses (see `imageUrlsIn`).
export const ImagesService = {
  /// Lets the user pick or take a photo, then downsizes and re-encodes it
  /// as JPEG. With `square`, the picker asks for a 1:1 crop (avatars).
  /// Returns the local file URI, or null if they cancelled.
  async pick(
    source: ImageSource,
    { square = false, maxEdge = MAX_EDGE }: { square?: boolean; maxEdge?: number } = {},
  ): Promise<string | null> {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new ImagePermissionError();

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 1,
      ...(square && { allowsEditing: true, aspect: [1, 1] as [number, number] }),
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || result.assets.length === 0) return null;

    const asset = result.assets[0];
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > maxEdge) {
      context.resize(asset.width >= asset.height ? { width: maxEdge } : { height: maxEdge });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
    return saved.uri;
  },

  /// Uploads a local image and returns its public https URL.
  async upload(localUri: string, uploaderUid: string): Promise<string> {
    const form = new FormData();
    // The global fetch is expo/fetch, which rejects React Native's
    // `{ uri, name, type }` parts; an expo-file-system File is a Blob it reads.
    form.append('file', new File(localUri), 'image.jpg');
    form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    form.append('tags', `uploader_${uploaderUid}`);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), UPLOAD_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${CLOUDINARY_API}/image/upload`, { method: 'POST', body: form, signal: abort.signal });
    } finally {
      clearTimeout(timer);
    }
    const body = (await response.json().catch(() => ({}))) as {
      secure_url?: string;
      delete_token?: string;
      error?: { message?: string };
    };
    if (!response.ok || !body.secure_url) {
      const reason = body.error?.message ?? `HTTP ${response.status}`;
      console.warn(`Cloudinary upload failed: ${reason}`);
      throw new ImageUploadError(reason);
    }
    const { secure_url: url, delete_token: token } = body;
    if (token) deleteTokens.set(url, { token, expiresAt: Date.now() + DELETE_TOKEN_TTL_MS });
    return url;
  },

  /// Best-effort delete of images by URL. Never throws — a leftover file
  /// only costs storage, and must not fail the note operation. Only images
  /// uploaded in this session within the last 10 minutes can be deleted
  /// (e.g. ones added then removed while composing); the rest stay on
  /// Cloudinary and can be cleaned up from its console (tag `uploader_*`).
  async deleteAll(urls: string[]): Promise<void> {
    await Promise.all(
      urls.map(async (url) => {
        const entry = deleteTokens.get(url);
        deleteTokens.delete(url);
        if (!entry || entry.expiresAt < Date.now()) return;
        const form = new FormData();
        form.append('token', entry.token);
        await fetch(`${CLOUDINARY_API}/delete_by_token`, { method: 'POST', body: form }).catch(() => {
          // Offline or already gone — nothing useful to do.
        });
      }),
    );
  },
};
