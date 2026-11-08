import { useState, type FormEvent } from 'react'
import { GroupGate, useGroupId, type GroupData } from '../components/GroupLayout'
import { Page } from '../components/AppShell'
import { Alert, Avatar, BackHeader, Button, Card, ConfirmDialog, Field, Input, Pill, SectionLabel } from '../components/ui'
import { IconSearch } from '../components/icons'
import { findUserByUsername, useGroupAction } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { USERNAME_RE, normalizeUsername } from '../lib/rules'
import type { Member, Profile } from '../lib/types'

export function MembersPage() {
  const groupId = useGroupId()
  return <GroupGate groupId={groupId}>{(d) => <Members d={d} />}</GroupGate>
}

function Members({ d }: { d: GroupData }) {
  const action = useGroupAction()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Profile | null | 'none'>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [invited, setInvited] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)

  const g = d.group
  const pending = g.group_members.filter((m) => m.status === 'invited')
  const isSome = g.mode === 'some'
  const adminCount = d.active.filter((m) => m.role === 'admin').length

  async function search(e: FormEvent) {
    e.preventDefault()
    const u = normalizeUsername(query)
    setInvited(null)
    setSearchError(null)
    if (!USERNAME_RE.test(u)) {
      setResult('none')
      return
    }
    setSearching(true)
    try {
      setResult((await findUserByUsername(u)) ?? 'none')
    } catch (err) {
      setSearchError(errorMessage(err))
    } finally {
      setSearching(false)
    }
  }

  async function invite(p: Profile) {
    try {
      await action.mutateAsync({ type: 'invite', groupId: g.id, username: p.username })
      setInvited(p.username)
      setResult(null)
      setQuery('')
    } catch {
      // Anzeige über action.error
    }
  }

  const alreadyIn = result && result !== 'none' ? g.group_members.some((m) => m.user_id === result.id) : false

  return (
    <Page>
      <BackHeader to="/groups/$groupId" params={{ groupId: g.id }} label="Zurück zum Anlass" title="Mitglieder" subtitle={g.name} />
      {action.error ? <Alert>{errorMessage(action.error)}</Alert> : null}

      {d.isAdmin ? (
        <form onSubmit={search} className="flex flex-col gap-2" noValidate>
          <Field htmlFor="q" label="Person einladen" hint="Aus Datenschutzgründen gibt es keine Vorschläge – nur exakte Usernamen.">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <IconSearch className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
                <Input id="q" className="pl-10.5" autoCapitalize="none" spellCheck={false} maxLength={24}
                  placeholder="Exakter Username" value={query} onChange={(e) => { setQuery(e.target.value); setResult(null) }} />
              </div>
              <Button type="submit" variant="secondary" size="md" className="h-12" loading={searching} disabled={!query.trim()}>Suchen</Button>
            </div>
          </Field>
          {searchError ? <Alert>{searchError}</Alert> : null}
          {result === 'none' ? <p className="m-0 text-sm text-ink-2">Kein Konto mit diesem Username gefunden.</p> : null}
          {result && result !== 'none' ? (
            <Card className="flex items-center gap-3 py-2.5 pr-2.5 pl-3.5">
              <Avatar name={result.display_name} seed={result.id} size={36} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold">{result.display_name}</span>
                <span className="text-[13px] text-muted">@{result.username}</span>
              </div>
              {alreadyIn ? <Pill tone="muted">Bereits dabei</Pill>
                : <Button size="md" onClick={() => invite(result)} loading={action.isPending}>Einladen</Button>}
            </Card>
          ) : null}
          {invited ? <Alert tone="success">@{invited} wurde eingeladen und muss die Einladung noch annehmen.</Alert> : null}
        </form>
      ) : (
        <Alert tone="info">Nur Admins können Personen einladen.</Alert>
      )}

      {pending.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>Eingeladen · wartet auf Annahme</SectionLabel>
          <Card>
            {pending.map((m) => (
              <div key={m.user_id} className="flex min-h-14 items-center gap-3 border-line py-2 pr-1.5 pl-3.5 not-first:border-t">
                <Avatar name={m.profile?.display_name ?? '?'} seed={m.user_id} size={36} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold">@{m.profile?.username ?? '?'}</span>
                  <span className="text-[13px] text-muted">eingeladen{m.inviter ? ` von ${m.inviter.display_name}` : ''}</span>
                </div>
                {d.isAdmin ? (
                  <Button variant="danger-ghost" size="sm"
                    onClick={() => action.mutate({ type: 'remove', groupId: g.id, userId: m.user_id })}>Zurückziehen</Button>
                ) : null}
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <section className="flex flex-col gap-2.5">
        <SectionLabel>Mitglieder · {d.active.length}</SectionLabel>
        {isSome ? <p className="m-0 text-[13px] text-muted">„Beschenkt“ = hat in diesem Anlass eine Wunschliste.</p> : null}
        <Card>
          {d.active.map((m) => {
            const self = m.user_id === d.userId
            return (
              <div key={m.user_id} className="flex flex-col gap-2 border-line px-3.5 py-2.5 not-first:border-t">
                <div className="flex min-h-11 items-center gap-3">
                  <Avatar name={m.profile?.display_name ?? '?'} seed={m.user_id} size={36} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-semibold">{m.profile?.display_name}{self ? ' (du)' : ''}</span>
                    <span className="text-[13px] text-muted">@{m.profile?.username}</span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {m.role === 'admin' ? <Pill tone="pine">Admin</Pill> : null}
                    {isSome && m.is_recipient ? <Pill tone="apricot">Beschenkt</Pill> : null}
                  </div>
                </div>
                {d.isAdmin ? (
                  <div className="flex flex-wrap gap-2 pl-12">
                    {!(self && m.role === 'admin' && adminCount <= 1) ? (
                      <Button variant="secondary" size="sm"
                        onClick={() => action.mutate({ type: 'role', groupId: g.id, userId: m.user_id, role: m.role === 'admin' ? 'member' : 'admin' })}>
                        {m.role === 'admin' ? (self ? 'Adminrolle abgeben' : 'Admin entziehen') : 'Zum Admin machen'}
                      </Button>
                    ) : null}
                    {isSome ? (
                      <Button variant="secondary" size="sm"
                        onClick={() => action.mutate({ type: 'recipient', groupId: g.id, userId: m.user_id, isRecipient: !m.is_recipient })}>
                        {m.is_recipient ? 'Nicht beschenken' : 'Beschenken'}
                      </Button>
                    ) : null}
                    {!self ? (
                      <Button variant="danger-ghost" size="sm" onClick={() => setRemoveTarget(m)}>Entfernen</Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </Card>
      </section>

      <ConfirmDialog open={!!removeTarget} title="Mitglied entfernen?" confirmLabel="Entfernen" loading={action.isPending}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (!removeTarget) return
          try {
            await action.mutateAsync({ type: 'remove', groupId: g.id, userId: removeTarget.user_id })
            setRemoveTarget(null)
          } catch { /* Anzeige oben */ }
        }}>
        {removeTarget?.profile?.display_name} verliert den Zugriff. Seine/ihre Wunschliste und Zusagen in diesem Anlass werden entfernt.
      </ConfirmDialog>
    </Page>
  )
}
