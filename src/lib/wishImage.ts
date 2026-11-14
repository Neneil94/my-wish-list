// Bild zum Wunsch: Prüfen, Verkleinern und Pfade.
// Regeln synchron halten mit supabase/migrations/20261109120000_wish_images.sql.
import { AppError } from './errors'

export const IMAGE_BUCKET = 'wish-images'
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif'
export const MAX_INPUT_BYTES = 15 * 1024 * 1024
/** Bucket-Limit ist 1 MiB; etwas Luft lassen. */
export const MAX_UPLOAD_BYTES = 900 * 1024
export const FULL_EDGE = 1600
export const THUMB_EDGE = 480

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export type ImageProblem = 'image_type' | 'image_too_large'

export function isHeic(file: { type: string; name: string }): boolean {
  return /^image\/hei[cf]$/.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

/** Schnelle Vorprüfung vor dem Dekodieren. */
export function checkImageFile(file: { type: string; name: string; size: number }): ImageProblem | null {
  if (!ACCEPTED_TYPES.has(file.type) && !isHeic(file)) return 'image_type'
  if (file.size > MAX_INPUT_BYTES) return 'image_too_large'
  return null
}

/** Skaliert proportional auf höchstens `max` px an der längeren Kante (nie vergrößern). */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 }
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export type ImageExt = 'webp' | 'jpg'

export function imagePath(groupId: string, wishId: string, id: string, ext: ImageExt): string {
  return `${groupId}/${wishId}/${id}.${ext}`
}

export function thumbPathOf(path: string): string {
  return path.replace(/\.(webp|jpg)$/, '-thumb.$1')
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
export const IMAGE_PATH_RE = new RegExp(`^${UUID}/${UUID}/${UUID}\\.(webp|jpg)$`)

// ------------------------------------------------------------------ Verarbeitung (nur Browser)

export interface ProcessedImage {
  full: Blob
  thumb: Blob
  ext: ImageExt
  contentType: 'image/webp' | 'image/jpeg'
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

function draw(bitmap: ImageBitmap, max: number, opaque: boolean): HTMLCanvasElement {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new AppError('image_decode')
  if (opaque) {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  return canvas
}

async function encode(bitmap: ImageBitmap, max: number, type: 'image/webp' | 'image/jpeg'): Promise<Blob | null> {
  const canvas = draw(bitmap, max, type === 'image/jpeg')
  for (const q of [0.82, 0.72, 0.6, 0.5]) {
    const blob = await canvasToBlob(canvas, type, q)
    if (!blob || blob.type !== type) return null
    if (blob.size <= MAX_UPLOAD_BYTES) return blob
  }
  return null
}

/**
 * Dekodiert das Bild, dreht es laut EXIF richtig und kodiert es neu. Dadurch gehen
 * alle Metadaten (inkl. GPS-Standort) verloren. WebP, wo der Browser es kodieren
 * kann, sonst JPEG.
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  const problem = checkImageFile(file)
  if (problem) throw new AppError(problem)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new AppError(isHeic(file) ? 'image_heic' : 'image_type')
  }
  try {
    for (const [type, ext] of [['image/webp', 'webp'], ['image/jpeg', 'jpg']] as const) {
      const full = await encode(bitmap, FULL_EDGE, type)
      if (!full) continue
      const thumb = await encode(bitmap, THUMB_EDGE, type)
      if (!thumb) continue
      return { full, thumb, ext, contentType: type }
    }
    throw new AppError('image_decode')
  } finally {
    bitmap.close()
  }
}
