import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LegalLink, Page } from '../components/AppShell'
import { Alert, Avatar, Button, Card, ConfirmDialog, Field, Input } from '../components/ui'
import { IconChevronRight, IconDevices, IconKey, IconLock, IconLogout, IconTrash } from '../components/icons'
import { deleteMyAccount, useMyProfile, useUpdateDisplayName } from '../lib/api'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/errors'

export function ProfilePage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const profile = useMyProfile()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function signOut(scope: 'local' | 'global') {
    await auth.signOut(scope)
    await navigate({ to: '/login' })
  }

  async function removeAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteMyAccount()
      await auth.signOut('local')
      await navigate({ to: '/gate' })
    } catch (err) {
      setDeleteError(errorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const p = profile.data
  const itemCls = 'flex min-h-13 w-full cursor-pointer items-center gap-3 border-0 border-line bg-transparent px-4 text-left text-[15px] font-medium text-ink no-underline not-first:border-t hover:bg-ground'

  return (
    <Page>
      <h1 className="m-0 pt-5 text-3xl font-bold md:pt-0">Profil</h1>
      {p ? (
        <div className="flex items-center gap-3.5">
          <Avatar name={p.display_name} seed={p.id} size={56} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[17px] font-semibold">{p.display_name}</span>
            <span className="text-[13px] text-muted">@{p.username}</span>
          </div>
        </div>
      ) : null}

      {p ? <DisplayNameForm key={p.display_name} current={p.display_name} /> : null}

      <Card className="overflow-hidden">
        <Link to="/profile/security" className={itemCls}>
          <IconLock size={20} className="text-pine" /><span className="flex-1">Passwort ändern</span><IconChevronRight className="text-muted" />
        </Link>
        <Link to="/profile/security" hash="recovery" className={itemCls}>
          <IconKey size={20} className="text-pine" /><span className="flex-1">Wiederherstellungscode erneuern</span><IconChevronRight className="text-muted" />
        </Link>
        <button type="button" className={itemCls} onClick={() => signOut('global')}>
          <IconDevices size={20} className="text-pine" /><span className="flex-1">Auf allen Geräten abmelden</span>
        </button>
        <button type="button" className={itemCls} onClick={() => signOut('local')}>
          <IconLogout size={20} className="text-pine" /><span className="flex-1">Abmelden</span>
        </button>
      </Card>

      <Card className="overflow-hidden">
        <button type="button" className={`${itemCls} text-danger`} onClick={() => setConfirmDelete(true)}>
          <IconTrash size={20} /><span className="flex-1">Konto und alle Daten löschen</span>
        </button>
      </Card>

      <LegalLink />

      <ConfirmDialog open={confirmDelete} title="Konto endgültig löschen?" confirmLabel="Konto löschen" loading={deleting}
        onClose={() => { setConfirmDelete(false); setDeleteText('') }}
        onConfirm={() => { if (deleteText === p?.username) void removeAccount() }}>
        <div className="flex flex-col gap-3">
          <p className="m-0">Alle deine Wunschlisten, Zusagen und Mitgliedschaften werden gelöscht. Das kann nicht rückgängig gemacht werden.</p>
          <Field label={<>Zur Bestätigung deinen Username „{p?.username}“ eingeben</>} htmlFor="confirm-user">
            <Input id="confirm-user" autoCapitalize="none" spellCheck={false} value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
          </Field>
          {deleteError ? <Alert>{deleteError}</Alert> : null}
        </div>
      </ConfirmDialog>
    </Page>
  )
}

function DisplayNameForm({ current }: { current: string }) {
  const update = useUpdateDisplayName()
  const [name, setName] = useState(current)
  const [saved, setSaved] = useState(false)

  async function saveName(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    try {
      await update.mutateAsync(name.trim())
      setSaved(true)
    } catch { /* Anzeige über update.error */ }
  }

  return (
    <Card className="p-4">
      <form onSubmit={saveName} className="flex flex-col gap-3.5" noValidate>
        {update.error ? <Alert>{errorMessage(update.error)}</Alert> : null}
        {saved ? <Alert tone="success">Gespeichert.</Alert> : null}
        <Field label="Anzeigename" htmlFor="dn" hint="Den Username kannst du nicht ändern – andere laden dich darüber ein.">
          <Input id="dn" maxLength={40} value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} />
        </Field>
        <Button type="submit" size="md" loading={update.isPending} disabled={!name.trim() || name.trim() === current}>Speichern</Button>
      </form>
    </Card>
  )
}
