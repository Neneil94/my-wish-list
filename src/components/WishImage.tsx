import { useEffect, useId, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { Button, Spinner } from './ui'
import { IconAlert, IconClose, IconExpand, IconGift, IconImage } from './icons'
import { errorMessage } from '../lib/errors'
import { IMAGE_ACCEPT, processImage, type ProcessedImage } from '../lib/wishImage'
import { useWishImageUrl } from '../lib/wishImageUrls'

// ------------------------------------------------------------------ Vorschaubild (Listen)

/** Quadratisches Vorschaubild; ohne Bild (oder wenn es nicht lädt) eine Geschenk-Kachel. */
export function WishThumb({ path, size = 56 }: { path: string | null; size?: 56 | 44 }) {
  const url = useWishImageUrl(path, 'thumb')
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const show = url && failedUrl !== url
  return (
    <span aria-hidden
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-line bg-subtle text-[#A7A39A] ${size === 56 ? 'size-14 rounded-xl' : 'size-11 rounded-[10px]'}`}>
      {show
        ? <img src={url} alt="" width={size} height={size} loading="lazy" decoding="async"
            className="size-full object-cover" onError={() => setFailedUrl(url)} />
        : <IconGift size={size === 56 ? 26 : 22} strokeWidth={1.6} />}
    </span>
  )
}

/** Bildkopf einer Karte (Desktop-Raster). Ohne Bild: nichts. */
export function WishCardImage({ path }: { path: string | null }) {
  const url = useWishImageUrl(path, 'thumb')
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!path || !url || failedUrl === url) return null
  return (
    <div aria-hidden className="-mx-4 -mt-3.5 mb-1 aspect-4/3 overflow-hidden rounded-t-2xl border-b border-line bg-subtle">
      <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => setFailedUrl(url)} />
    </div>
  )
}

// ------------------------------------------------------------------ Detailseite

export function WishPhoto({ path, title }: { path: string; title: string }) {
  const url = useWishImageUrl(path, 'full')
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  if (url && failedUrl === url) return null
  const alt = `Bild zu: ${title}`
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${alt} – vergrößern`} disabled={!url}
        className="relative block aspect-4/3 w-full cursor-zoom-in overflow-hidden rounded-2xl border border-line bg-subtle p-0">
        {url ? <img src={url} alt={alt} decoding="async" className="size-full object-contain" onError={() => setFailedUrl(url)} />
          : <span className="flex size-full items-center justify-center text-muted"><Spinner /></span>}
        <span aria-hidden className="absolute right-2.5 bottom-2.5 flex size-9 items-center justify-center rounded-[10px] bg-white/90 text-ink shadow-sm">
          <IconExpand size={18} />
        </span>
      </button>
      {url ? <WishImageLightbox open={open} onClose={() => setOpen(false)} url={url} title={title} /> : null}
    </>
  )
}

function WishImageLightbox({ open, onClose, url, title }: { open: boolean; onClose: () => void; url: string; title: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const startY = useRef<number | null>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  // Nach unten wischen schließt (nur Touch, damit Maus-Klicks nichts auslösen).
  const onPointerDown = (e: PointerEvent) => { startY.current = e.pointerType === 'touch' ? e.clientY : null }
  const onPointerUp = (e: PointerEvent) => {
    if (startY.current !== null && e.clientY - startY.current > 80) onClose()
    startY.current = null
  }

  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} onCancel={onClose}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-[#0F1013] p-0 text-white backdrop:bg-black">
      <div className="mx-auto flex h-full max-w-5xl flex-col gap-3 px-3 pt-3 pb-7">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} aria-label="Schließen"
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent text-white hover:bg-white/10 focus-visible:outline-white">
            <IconClose />
          </button>
          <h2 id={titleId} className="m-0 truncate font-sans text-sm font-medium text-[#D8D6D0]">{title}</h2>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <img src={url} alt={`Bild zu: ${title}`} className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
        <p className="m-0 text-center text-[13px] text-[#A7A39A]">
          Zum Vergrößern mit zwei Fingern ziehen. Schließen mit X, Esc oder nach unten wischen.
        </p>
      </div>
    </dialog>
  )
}

// ------------------------------------------------------------------ Formular

export type ImageFieldValue =
  | { kind: 'none' }
  | { kind: 'existing'; path: string }
  | { kind: 'new'; image: ProcessedImage; preview: string }

export function WishImageField({ value, onChange, uploading, title }: {
  value: ImageFieldValue
  onChange: (v: ImageFieldValue) => void
  uploading: boolean
  title: string
}) {
  const inputId = useId()
  const labelId = `${inputId}-label`
  const hintId = `${inputId}-hint`
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const existingUrl = useWishImageUrl(value.kind === 'existing' ? value.path : null, 'full')
  const previewRef = useRef<string | null>(null)

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])

  function replacePreview(next: ImageFieldValue) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = next.kind === 'new' ? next.preview : null
    onChange(next)
  }

  async function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    setPreparing(true)
    try {
      const image = await processImage(file)
      replacePreview({ kind: 'new', image, preview: URL.createObjectURL(image.full) })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPreparing(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void pick(e.dataTransfer.files[0])
  }

  const src = value.kind === 'new' ? value.preview : value.kind === 'existing' ? existingUrl : null
  const hasImage = value.kind !== 'none'
  const hint = error
    ?? (value.kind === 'new' ? 'Wird beim Speichern hochgeladen. Standortdaten sind bereits entfernt.'
      : value.kind === 'existing' ? 'Nur für Mitglieder dieses Anlasses sichtbar.'
        : 'JPG, PNG, WebP oder HEIC, bis 15 MB. Wird verkleinert, Standortdaten werden entfernt.')

  const fileInput = (
    <input id={inputId} type="file" accept={IMAGE_ACCEPT} className="sr-only" disabled={preparing || uploading}
      aria-labelledby={labelId} aria-describedby={hintId} aria-invalid={error ? true : undefined}
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pick(f) }} />
  )

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-semibold text-ink">Bild<span className="font-normal text-muted"> (optional)</span></span>
      {hasImage ? (
        <>
          <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-line bg-subtle">
            {src ? <img src={src} alt={`Bild zu: ${title || 'diesem Wunsch'}`} className="size-full object-contain" /> : null}
            {uploading || preparing || !src ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/45 text-sm font-semibold text-white" role="status">
                <Spinner />{uploading ? 'Bild wird hochgeladen …' : 'Bild wird vorbereitet …'}
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <label htmlFor={inputId}
              className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center rounded-xl border border-line-2 bg-surface text-[13px] font-semibold text-ink select-none hover:bg-[#FBFAF7] has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-pine has-[:focus-visible]:outline-offset-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
              {fileInput}Anderes Bild
            </label>
            <Button variant="danger-ghost" size="sm" className="flex-1" disabled={uploading || preparing}
              onClick={() => { setError(null); replacePreview({ kind: 'none' }) }}>
              Bild entfernen
            </Button>
          </div>
        </>
      ) : (
        <label htmlFor={inputId}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
          className={`flex min-h-33 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center select-none
            has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-pine has-[:focus-visible]:outline-offset-2
            ${error ? 'border-2 border-danger bg-surface' : dragOver ? 'border-[1.5px] border-dashed border-pine bg-pine-soft' : 'border-[1.5px] border-dashed border-line-2 bg-surface hover:bg-[#FBFAF7]'}`}>
          {fileInput}
          <span className={`flex size-11 items-center justify-center rounded-full ${error ? 'bg-danger-soft text-danger' : 'bg-pine-soft text-pine'}`}>
            {preparing ? <Spinner /> : error ? <IconAlert size={22} /> : <IconImage size={22} strokeWidth={2} />}
          </span>
          <span className="text-[15px] font-semibold">{preparing ? 'Bild wird vorbereitet …' : 'Foto hinzufügen'}</span>
          <span className="text-[13px] text-muted">Aufnehmen oder aus deinen Fotos wählen</span>
        </label>
      )}
      <p id={hintId} role={error ? 'alert' : undefined}
        className={`m-0 text-[13px] leading-snug ${error ? 'text-danger' : 'text-muted'}`}>{hint}</p>
    </div>
  )
}
