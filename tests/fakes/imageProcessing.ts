// Stands in for src/lib/imageProcessing.ts, which needs a browser canvas.
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp'
export const PHOTO_MAX_EDGE = 1600
export const AVATAR_MAX_EDGE = 512

export class ImageError extends Error {}

export async function prepareImage(file: { type: string }): Promise<Blob> {
  if (file.type === 'text/plain') throw new ImageError('Choose a JPEG, PNG or WebP image.')
  return new Blob(['jpeg-bytes'])
}
