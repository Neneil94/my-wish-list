import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Page } from '../components/AppShell'
import { Alert, Button, ConfirmDialog, Field, Input, Loading, Textarea } from '../components/ui'
import { IconClose } from '../components/icons'
import { useGroup, useGroupAction, useSaveGroup, type GroupInput } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { groupSchema } from '../lib/rules'
import type { GroupWithMembers } from '../lib/types'

export function NewGroupPage() {
  return <GroupForm />
}

export function EditGroupPage() {
  const { groupId } = useParams({ strict: false }) as { groupId: string }
  const group = useGroup(groupId)
  if (group.isPending) return <Page><Loading /></Page>
  if (group.error) return <Page><Alert>{errorMessage(group.error)}</Alert></Page>
  return <GroupForm group={group.data} />
}

const MODES = [
  { id: 'all', title: 'Alle Mitglieder', text: 'Jede Person pflegt eine eigene Wunschliste – z. B. Weihnachten.' },
  { id: 'some', title: 'Bestimmte Person(en)', text: 'Nur Geehrte haben eine Liste – z. B. Geburtstag, Hochzeit. Festlegen unter „Mitglieder“.' },
] as const

function GroupForm({ group }: { group?: GroupWithMembers }) {
  const navigate = useNavigate()
  const save = useSaveGroup()
  const groupAction = useGroupAction()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<GroupInput>({
    name: group?.name ?? '',
    occasionDate: group?.occasion_date ?? '',
    description: group?.description ?? '',
    mode: group?.mode ?? 'all',
  })
  const [touched, setTouched] = useState(false)
  const parsed = groupSchema.safeParse(form)
  const fieldError = (k: keyof GroupInput) =>
    touched && !parsed.success ? parsed.error.issues.find((i) => i.path[0] === k)?.message ?? null : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!parsed.success) return
    const gid = await save.mutateAsync({ groupId: group?.id, input: parsed.data }).catch(() => null)
    if (!gid) return
    if (group) await navigate({ to: '/groups/$groupId', params: { groupId: gid } })
    else await navigate({ to: '/groups/$groupId/members', params: { groupId: gid } })
  }

  async function remove() {
    if (!group) return
    try {
      await groupAction.mutateAsync({ type: 'delete', groupId: group.id })
      await navigate({ to: '/' })
    } catch {
      // Fehler wird im Dialog angezeigt
    }
  }

  return (
    <Page>
      <div className="flex items-center justify-between">
        <Link to={group ? '/groups/$groupId' : '/'} params={group ? { groupId: group.id } : {}} aria-label="Schließen"
          className="-ml-2.5 inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-subtle">
          <IconClose />
        </Link>
        <h1 className="m-0 font-sans text-[15px] font-semibold">{group ? 'Anlass bearbeiten' : 'Neuer Anlass'}</h1>
        <span className="w-11" />
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4.5" noValidate>
        {save.error ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <Field label="Name des Anlasses" htmlFor="n" error={fieldError('name')}>
          <Input id="n" maxLength={60} value={form.name} placeholder="z. B. Weihnachten 2026"
            onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!fieldError('name')} />
        </Field>
        <Field label="Datum" htmlFor="dt" optional hint="Nach dem Datum wird der Anlass automatisch archiviert.">
          <Input id="dt" type="date" value={form.occasionDate} onChange={(e) => setForm({ ...form, occasionDate: e.target.value })} />
        </Field>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold">Wer bekommt Geschenke?</legend>
          {MODES.map((m) => {
            const on = form.mode === m.id
            return (
              <label key={m.id}
                className={`flex cursor-pointer items-start gap-3 rounded-[14px] bg-surface p-3.5 ${on ? 'border-2 border-pine' : 'border border-line'}`}>
                <input type="radio" name="mode" value={m.id} checked={on} onChange={() => setForm({ ...form, mode: m.id })}
                  className="mt-0.5 size-5 shrink-0 accent-pine" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{m.title}</span>
                  <span className="text-[13px] leading-snug text-muted">{m.text}</span>
                </span>
              </label>
            )
          })}
        </fieldset>
        <Field label="Beschreibung" htmlFor="ds" optional error={fieldError('description')}>
          <Textarea id="ds" maxLength={500} value={form.description} placeholder="z. B. Wichteln bei Oma, Budget ca. 50 € pro Person."
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Button type="submit" loading={save.isPending} className="mt-2">
          {group ? 'Änderungen speichern' : 'Erstellen & Mitglieder einladen'}
        </Button>
        {group ? <Button variant="danger-outline" onClick={() => setConfirmDelete(true)}>Anlass löschen</Button> : null}
      </form>
      {group ? (
        <ConfirmDialog open={confirmDelete} title="Anlass löschen?" confirmLabel="Endgültig löschen"
          loading={groupAction.isPending} onClose={() => setConfirmDelete(false)} onConfirm={remove}>
          „{group.name}“ wird mit allen Wunschlisten und Zusagen für alle Mitglieder gelöscht. Das lässt sich nicht rückgängig machen.
          {groupAction.error ? <Alert className="mt-3">{errorMessage(groupAction.error)}</Alert> : null}
        </ConfirmDialog>
      ) : null}
    </Page>
  )
}
