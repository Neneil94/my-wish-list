// Signierte URLs für Wunschbilder. Der Bucket ist privat; jede URL gilt 1 Stunde
// (wie jwt_expiry). Anfragen aus demselben Render werden zu einem Aufruf gebündelt.
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { IMAGE_BUCKET, thumbPathOf } from './wishImage'

const EXPIRES_IN = 60 * 60

type Pending = { resolve: (url: string | null) => void; reject: (e: unknown) => void }
let queue = new Map<string, Pending[]>()
let scheduled = false

async function flush() {
  scheduled = false
  const batch = queue
  queue = new Map()
  const paths = [...batch.keys()]
  try {
    const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, EXPIRES_IN)
    if (error) throw error
    const byPath = new Map((data ?? []).map((d) => [d.path, d.error ? null : d.signedUrl]))
    for (const [path, waiters] of batch) waiters.forEach((w) => w.resolve(byPath.get(path) ?? null))
  } catch (e) {
    for (const waiters of batch.values()) waiters.forEach((w) => w.reject(e))
  }
}

function signedUrl(path: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    queue.set(path, [...(queue.get(path) ?? []), { resolve, reject }])
    if (!scheduled) {
      scheduled = true
      setTimeout(flush, 0)
    }
  })
}

/** URL zum Bild eines Wunsches oder null (kein Bild / nicht ladbar). */
export function useWishImageUrl(imagePath: string | null | undefined, variant: 'full' | 'thumb'): string | null {
  const path = imagePath ? (variant === 'thumb' ? thumbPathOf(imagePath) : imagePath) : null
  const q = useQuery({
    queryKey: ['wish-image-url', path],
    enabled: !!path,
    queryFn: () => signedUrl(path!),
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    retry: 1,
  })
  return q.data ?? null
}
