export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp'
export const PHOTO_MAX_EDGE = 1600
export const AVATAR_MAX_EDGE = 512

// The message is safe to show to the user as is.
export class ImageError extends Error {}

// Scales the image down and re-encodes it as JPEG. Re-encoding also drops the photo's metadata,
// including the GPS location a phone camera embeds.
export async function prepareImage(file: File, maxEdge: number, quality = 0.85): Promise<Blob> {
  if (!ACCEPTED_IMAGE_TYPES.split(',').includes(file.type)) {
    throw new ImageError('Choose a JPEG, PNG or WebP image.')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageError('That image couldn’t be read. Try a different one.')
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d')
  if (!context) throw new ImageError('Your browser can’t process images.')
  context.fillStyle = '#fff' // transparent PNGs would turn black in a JPEG
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new ImageError('That image couldn’t be processed. Try a different one.')
  return blob
}
