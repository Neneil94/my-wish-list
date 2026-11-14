import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { GroupGate, useGroupId, type GroupData } from '../components/GroupLayout'
import { Page } from '../components/AppShell'
import { Alert, Avatar, BackHeader, Button, Card, ConfirmDialog, Pill, ProgressBar, SectionLabel, btn } from '../components/ui'
import { IconExternal, IconImage } from '../components/icons'
import { WishPhoto } from '../components/WishImage'
import { useClaimAction } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { formatCents } from '../lib/money'
import { safeHttpsUrl, urlHost } from '../lib/rules'
import { summarize } from '../lib/wishStatus'

export function WishDetailPage() {
  const groupId = useGroupId()
  const { wishId } = useParams({ strict: false }) as { wishId: string }
  return <GroupGate groupId={groupId}>{(d) => <WishDetail d={d} wishId={wishId} />}</GroupGate>
}

function WishDetail({ d, wishId }: { d: GroupData; wishId: string }) {
  const action = useClaimAction(d.group.id)
  const [confirmUnclaim, setConfirmUnclaim] = useState(false)
  const wish = d.wishes.find((w) => w.id === wishId)
  if (!wish) return <Page><Alert>Diesen Wunsch gibt es nicht (mehr).</Alert></Page>

  const isOwner = wish.owner_id === d.userId
  const owner = d.active.find((m) => m.user_id === wish.owner_id)
  const ownerName = owner?.profile?.display_name ?? 'Unbekannt'
  const s = summarize(wish, d.claims, d.userId)
  const claims = d.claims.filter((c) => c.wish_id === wish.id)
  const nameOf = (uid: string) => d.active.find((m) => m.user_id === uid)?.profile?.display_name ?? 'Ehemaliges Mitglied'
  const link = wish.url ? safeHttpsUrl(wish.url) : null
  const params = { groupId: d.group.id, wishId: wish.id }

  return (
    <Page>
      {isOwner
        ? <BackHeader to="/groups/$groupId/my-list" params={{ groupId: d.group.id }} label="Zurück zu meiner Liste" />
        : <BackHeader to="/groups/$groupId/people/$userId" params={{ groupId: d.group.id, userId: wish.owner_id }} label={`Zurück zur Liste von ${ownerName}`} />}

      {wish.image_path ? <WishPhoto path={wish.image_path} title={wish.title} /> : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {wish.priority === 'top' ? <Pill tone="pine">Top-Wunsch</Pill> : null}
          {!isOwner && s.state === 'group' ? <Pill tone="apricot">Gruppengeschenk</Pill> : null}
          {!isOwner && s.state === 'covered' ? <Pill tone="muted">Vergeben</Pill> : null}
        </div>
        <h1 className="m-0 text-[28px] leading-tight font-bold">{wish.title}</h1>
        <span className="font-display text-[22px] font-medium">{wish.price_cents !== null ? formatCents(wish.price_cents) : 'ohne Preis'}</span>
        {!isOwner ? <span className="text-[13px] text-muted">Wunsch von {ownerName}</span> : null}
        {wish.description ? <p className="m-0 text-sm whitespace-pre-line text-ink-2">{wish.description}</p> : null}
      </div>

      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className={btn('secondary', 'md')}>
          <IconExternal />Produkt ansehen · {urlHost(link)}
        </a>
      ) : null}

      {isOwner ? (
        <>
          <Alert tone="warn">Das ist dein eigener Wunsch. Ob ihn jemand beansprucht hat, bleibt eine Überraschung.</Alert>
          {!wish.image_path ? (
            <Link to="/groups/$groupId/wishes/$wishId/edit" params={params} className={btn('secondary', 'md')}>
              <IconImage size={18} />Bild hinzufügen
            </Link>
          ) : null}
        </>
      ) : (
        <>
          {action.error ? <Alert>{errorMessage(action.error)}</Alert> : null}
          {claims.length > 0 ? (
            <Card className="flex flex-col gap-3 p-4">
              {wish.price_cents !== null ? (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-semibold">{formatCents(s.coveredCents, true)} von {formatCents(wish.price_cents, true)}</span>
                    {s.remainingCents ? <span className="text-[13px] font-semibold text-apricot-ink">noch {formatCents(s.remainingCents, true)} offen</span>
                      : <span className="text-[13px] font-semibold text-pine">vollständig gedeckt</span>}
                  </div>
                  <ProgressBar value={s.coveredCents / Math.max(1, wish.price_cents)} height={10} label="Anteil gedeckt" />
                </>
              ) : <span className="text-[15px] font-semibold">{formatCents(s.coveredCents, true)} gesammelt</span>}
              <SectionLabel>Beteiligt · {claims.length}</SectionLabel>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {claims.map((c) => (
                  <li key={c.id} className="flex min-h-11 items-center gap-2.5">
                    <Avatar name={nameOf(c.user_id)} seed={c.user_id} size={32} />
                    <span className="flex-1 text-sm font-medium">
                      {c.user_id === d.userId ? 'Du' : nameOf(c.user_id)}
                      {c.is_organizer ? <span className="text-muted"> · kauft &amp; bestellt</span> : null}
                      {c.kind === 'full' ? <span className="text-muted"> · schenkt komplett</span> : null}
                    </span>
                    {c.amount_cents !== null ? <span className="text-sm font-semibold">{formatCents(c.amount_cents, true)}</span> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card className="p-4 text-sm text-ink-2">Noch niemand hat zugesagt.</Card>
          )}

          {claims.filter((c) => c.note).map((c) => (
            <Card key={`note-${c.id}`} className="flex items-start gap-2.5 px-3.5 py-3">
              <Avatar name={nameOf(c.user_id)} seed={c.user_id} size={32} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold">{c.user_id === d.userId ? 'Du' : nameOf(c.user_id)} · Absprache</span>
                <p className="m-0 text-sm leading-snug whitespace-pre-line text-ink-2">{c.note}</p>
              </div>
            </Card>
          ))}

          <div className="flex gap-2.5 pt-2">
            {s.myClaim ? (
              <>
                {s.myClaim.kind === 'share' ? (
                  <Link to="/groups/$groupId/wishes/$wishId/claim" params={params} className={btn('secondary', 'md', 'flex-1')}>Beitrag ändern</Link>
                ) : null}
                <Button variant="danger-outline" size="md" className="flex-1" onClick={() => setConfirmUnclaim(true)}>Zurückziehen</Button>
              </>
            ) : s.state === 'open' ? (
              <Link to="/groups/$groupId/wishes/$wishId/claim" params={params} className={btn('primary', 'lg', 'flex-1')}>Beanspruchen</Link>
            ) : s.state === 'group' ? (
              <Link to="/groups/$groupId/wishes/$wishId/claim" params={params} className={btn('accent', 'lg', 'flex-1')}>Beim Gruppengeschenk mitmachen</Link>
            ) : null}
          </div>
        </>
      )}

      <ConfirmDialog open={confirmUnclaim} title="Zusage zurückziehen?" confirmLabel="Zurückziehen" loading={action.isPending}
        onClose={() => setConfirmUnclaim(false)}
        onConfirm={async () => {
          try {
            await action.mutateAsync({ type: 'unclaim', wishId: wish.id })
            setConfirmUnclaim(false)
          } catch { /* Anzeige oben */ }
        }}>
        Der Wunsch ist danach wieder für andere frei.
      </ConfirmDialog>
    </Page>
  )
}
