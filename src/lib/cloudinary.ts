/// Cloudinary account that hosts note images (see `services/imagesService.ts`).
/// Neither value is a secret: uploads use an *unsigned* upload preset, so the
/// app never holds the API secret. Set both before building.
///
/// Create the preset in the Cloudinary console: Settings → Upload → Upload
/// presets → Add. Signing mode "Unsigned", asset folder "memostack/note-images",
/// allowed formats "jpg", and turn on "Return delete token".
export const CLOUDINARY_CLOUD_NAME = 'isqf9tav';
export const CLOUDINARY_UPLOAD_PRESET = 'memostack_notes';

export const CLOUDINARY_API = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}`;
