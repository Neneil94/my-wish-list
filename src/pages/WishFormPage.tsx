import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { GroupGate, useGroupId, type GroupData } from '../components/GroupLayout'
import { Page } from '../components/AppShell'
import { Alert, Button, ConfirmDialog, Field, Input, Textarea } from '../components/ui'
import { IconClose } from '../components/icons'
import { WishImageField, type ImageFieldValue } from '../components/WishImage'
import { WishImageError, useSaveWish, useWishAction, type ImageChange } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { centsToInput, parseEuroToCents } from '../lib/money'
import { safeHttpsUrl, wishSchema } from '../lib/rules'
import type { Wish } from '../lib/types'

export function WishFormPage() {
  const groupId = useGroupId()
  const { wishId } = useParams({ strict: false }) as { wishId?: string }
  return (
    <GroupGate groupId={groupId}>
      {(d) => {
        const wish = wishId ? d.wishes.find((w) => w.id === wishId && w.owner_id === d.userId) : undefined
        if (wishId && !wish) return <Page><Alert>Diesen Wunsch gibt es nicht oder er gehört dir nicht.</Alert></Page>
        return <WishForm d={d} wish={wish} />
      }}
    </GroupGate>
  )
}

function WishForm({ d, wish }: { d: GroupData; wish?: Wish }) {
  const navigate = useNavigate()
  const save = useSaveWish(d.group.id)
  const del = useWishAction(d.group.id)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [touched, setTouched] = useState(false)
  const [form, setForm] = useState({
    title: wish?.title ?? '',
    url: wish?.url ?? '',
    description: wish?.description ?? '',
    price: centsToInput(wish?.price_cents ?? null),
    priority: wish?.priority ?? ('normal' as 'normal' | 'top'),
  })
  const initialImage: ImageFieldValue = wish?.image_path ? { kind: 'existing', path: wish.image_path } : { kind: 'none' }
  const [image, setImage] = useState<ImageFieldValue>(initialImage)
  // Wurde der Wunsch schon gespeichert, nur das Bild nicht: erneuter Versuch bearbeitet diesen Wunsch.
  const [savedId, setSavedId] = useState<string | null>(null)
  const imageSaved = !!wish?.image_path

  const parsed = wishSchema.safeParse(form)
  const price = parseEuroToCents(form.price)
  const err = (k: string) => (touched && !parsed.success ? parsed.error.issues.find((i) => i.path[0] === k)?.message ?? null : null)
  const urlBad = form.url.trim() !== '' && safeHttpsUrl(form.url) === null
  const priceError = touched && price === undefined ? 'Bitte einen gültigen Betrag eingeben, z. B. 49,90.' : null
  const back = { to: '/groups/$groupId/my-list' as const, params: { groupId: d.group.id } }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!parsed.success || price === undefined) return
    const change: ImageChange = image.kind === 'new' ? { type: 'set', image: image.image }
      : image.kind === 'none' && imageSaved ? { type: 'remove' } : { type: 'keep' }
    try {
      await save.mutateAsync({
        wishId: wish?.id ?? savedId ?? undefined,
        image: change,
        input: {
          title: parsed.data.title,
          description: parsed.data.description,
          url: parsed.data.url ? safeHttpsUrl(parsed.data.url) : null,
          priceCents: price,
          priority: parsed.data.priority,
        },
      })
      await navigate(back)
    } catch (e) {
      if (e instanceof WishImageError) setSavedId(e.wishId)
    }
  }

  return (
    <Page>
      <div className="flex items-center justify-between">
        <Link {...back} aria-label="Schließen" className="-ml-2.5 inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-subtle"><IconClose /></Link>
        <h1 className="m-0 font-sans text-[15px] font-semibold">{wish ? 'Wunsch bearbeiten' : 'Neuer Wunsch'}</h1>
        <span className="w-11" />
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {save.error ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <WishImageField value={image} onChange={setImage} title={form.title}
          uploading={save.isPending && image.kind === 'new'} />
        <Field label="Titel" htmlFor="t" error={err('title')}>
          <Input id="t" maxLength={80} value={form.title} placeholder="z. B. Wanderschuhe Gr. 44"
            onChange={(e) => setForm({ ...form, title: e.target.value })} invalid={!!err('title')} />
        </Field>
        <Field label="Link zum Produkt" htmlFor="l" optional
          error={urlBad ? 'Nur sichere https://-Links sind erlaubt.' : null}
          hint="Nur https://-Links. Der Link wird nicht vom Server abgerufen.">
          <Input id="l" type="url" inputMode="url" autoCapitalize="none" spellCheck={false} maxLength={2000}
            placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} invalid={urlBad} />
        </Field>
        <Field label="Beschreibung" htmlFor="d" optional error={err('description')}>
          <Textarea id="d" maxLength={500} value={form.description} placeholder="Größe, Farbe, Varianten …"
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Preis / Wert" htmlFor="pr" error={priceError} hint="Hilft anderen beim Aufteilen. Leer lassen, wenn unbekannt.">
          <div className="relative">
            <Input id="pr" inputMode="decimal" className="pr-10" maxLength={14} value={form.price} placeholder="0,00"
              onChange={(e) => setForm({ ...form, price: e.target.value })} invalid={!!priceError} />
            <span className="pointer-events-none absolute top-3 right-3.5 text-base font-medium text-muted" aria-hidden>€</span>
          </div>
        </Field>
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 text-sm font-semibold">Priorität</legend>
          <div className="flex gap-1.5 rounded-xl bg-[#EAE8E2] p-1">
            {([['normal', 'Normal'], ['top', 'Top-Wunsch']] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={form.priority === id} onClick={() => setForm({ ...form, priority: id })}
                className={`h-11 flex-1 cursor-pointer rounded-[10px] border-0 text-sm font-semibold ${form.priority === id ? 'bg-surface text-ink shadow-sm' : 'bg-transparent text-ink-2'}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <Button type="submit" loading={save.isPending} className="mt-2">Wunsch speichern</Button>
        {wish ? <Button variant="danger-outline" onClick={() => setConfirmDelete(true)}>Wunsch löschen</Button> : null}
      </form>
      {wish ? (
        <ConfirmDialog open={confirmDelete} title="Wunsch löschen?" confirmLabel="Löschen" loading={del.isPending}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await del.mutateAsync({ type: 'delete', wishId: wish.id })
              await navigate(back)
            } catch { /* Anzeige unten */ }
          }}>
          „{wish.title}“ wird von deiner Liste entfernt. Falls jemand ihn schon beansprucht hat, wird die Person informiert.
          {wish.image_path ? ' Das Bild wird ebenfalls gelöscht.' : null}
          {del.error ? <Alert className="mt-3">{errorMessage(del.error)}</Alert> : null}
        </ConfirmDialog>
      ) : null}
    </Page>
  )
}
