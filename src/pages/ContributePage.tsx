import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { GroupGate, useGroupId, type GroupData } from '../components/GroupLayout'
import { Page } from '../components/AppShell'
import { Alert, Button, Card, Field, Input, ProgressBar } from '../components/ui'
import { IconClose, IconEyeOff } from '../components/icons'
import { useClaimAction } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { centsToInput, formatCents, parseEuroToCents } from '../lib/money'
import { summarize } from '../lib/wishStatus'

export function ContributePage() {
  const groupId = useGroupId()
  const { wishId } = useParams({ strict: false }) as { wishId: string }
  return <GroupGate groupId={groupId}>{(d) => <Contribute d={d} wishId={wishId} />}</GroupGate>
}

function Contribute({ d, wishId }: { d: GroupData; wishId: string }) {
  const navigate = useNavigate()
  const action = useClaimAction(d.group.id)
  const wish = d.wishes.find((w) => w.id === wishId)
  const s = wish ? summarize(wish, d.claims, d.userId) : null
  const others = s ? s.coveredCents - (s.myClaim?.amount_cents ?? 0) : 0
  const rest = wish?.price_cents != null ? Math.max(0, wish.price_cents - others) : null
  const joining = !!s && s.contributors - (s.myClaim ? 1 : 0) > 0

  const [mode, setMode] = useState<'full' | 'share'>(joining || s?.myClaim?.kind === 'share' ? 'share' : 'full')
  const [amount, setAmount] = useState(centsToInput(s?.myClaim?.amount_cents ?? null) || (rest ? centsToInput(Math.min(rest, 5000)) : ''))
  const [note, setNote] = useState(s?.myClaim?.note ?? '')
  const [organizer, setOrganizer] = useState(s?.myClaim?.is_organizer ?? false)
  const [touched, setTouched] = useState(false)
  const [restMode, setRestMode] = useState(false)

  if (!wish || !s) return <Page><Alert>Diesen Wunsch gibt es nicht (mehr).</Alert></Page>
  if (wish.owner_id === d.userId) return <Page><Alert>Eigene Wünsche kannst du nicht beanspruchen.</Alert></Page>

  const ownerName = d.active.find((m) => m.user_id === wish.owner_id)?.profile?.display_name ?? 'Unbekannt'
  const blocked = (s.fullClaim && s.fullClaim.user_id !== d.userId) || (!s.myClaim && s.state === 'covered')
  const cents = parseEuroToCents(amount)
  const amountError = touched && mode === 'share'
    ? cents === undefined || cents === null || cents <= 0 ? 'Bitte einen Betrag größer 0 eingeben.'
      : rest !== null && cents > rest ? `Höchstens ${formatCents(rest)} sind noch offen.` : null
    : null

  // "Komplett" nur, wenn sonst niemand beteiligt ist. Bei laufendem Gruppengeschenk: Rest übernehmen.
  const modes = joining
    ? [
        ...(rest ? [{ id: 'rest' as const, t: `Restbetrag übernehmen (${formatCents(rest, true)})`, d: 'Damit ist der Wunsch vollständig gedeckt.' }] : []),
        { id: 'share' as const, t: 'Teilbetrag beisteuern', d: 'Du wählst, wie viel du gibst.' },
      ]
    : [
        { id: 'full' as const, t: 'Ich schenke es komplett', d: 'Der Wunsch ist dann für alle anderen vergeben.' },
        { id: 'share' as const, t: 'Gruppengeschenk starten', d: 'Du gibst einen Teil, andere können sich anschließen.' },
      ]
  const selected = joining ? (restMode ? 'rest' : 'share') : mode

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    const isShare = joining || mode === 'share'
    const amountCents = joining && restMode ? rest : isShare ? cents : null
    if (isShare && (!amountCents || amountCents <= 0 || (rest !== null && amountCents > rest))) return
    try {
      await action.mutateAsync({
        type: 'claim', wishId: wish!.id, kind: isShare ? 'share' : 'full',
        amountCents: amountCents ?? null, note: note.trim(), isOrganizer: organizer,
      })
      await navigate({ to: '/groups/$groupId/wishes/$wishId', params: { groupId: d.group.id, wishId: wish!.id } })
    } catch { /* Anzeige über action.error */ }
  }

  const chips = [2000, 3000, 5000].filter((c) => rest === null || c < rest)

  return (
    <Page>
      <div className="flex items-center justify-between">
        <Link to="/groups/$groupId/wishes/$wishId" params={{ groupId: d.group.id, wishId: wish.id }} aria-label="Schließen"
          className="-ml-2.5 inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-subtle"><IconClose /></Link>
        <h1 className="m-0 font-sans text-[15px] font-semibold">
          {s.myClaim ? 'Zusage ändern' : joining ? 'Beim Gruppengeschenk mitmachen' : 'Wunsch beanspruchen'}
        </h1>
        <span className="w-11" />
      </div>

      <Card className="flex flex-col gap-2 px-4 py-3.5">
        <span className="text-[13px] text-muted">Wunsch von {ownerName}</span>
        <span className="text-base font-semibold">{wish.title}{wish.price_cents !== null ? ` · ${formatCents(wish.price_cents, true)}` : ''}</span>
        {wish.price_cents !== null ? <ProgressBar value={others / Math.max(1, wish.price_cents)} /> : null}
        <span className="text-[13px] text-muted">
          {others > 0 ? `${formatCents(others, true)}${wish.price_cents !== null ? ` von ${formatCents(wish.price_cents, true)}` : ''} von anderen zugesagt` : 'Noch niemand sonst hat zugesagt'}
        </span>
      </Card>

      {blocked ? <Alert>Dieser Wunsch ist bereits vollständig vergeben.</Alert> : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {action.error ? <Alert>{errorMessage(action.error)}</Alert> : null}
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold">Wie möchtest du schenken?</legend>
            {modes.map((o) => {
              const on = selected === o.id
              return (
                <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-[14px] bg-surface p-3.5 ${on ? 'border-2 border-pine' : 'border border-line'}`}>
                  <input type="radio" name="mode" checked={on} className="mt-0.5 size-5 shrink-0 accent-pine"
                    onChange={() => { if (o.id === 'rest') setRestMode(true); else { setRestMode(false); setMode(o.id) } }} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{o.t}</span>
                    <span className="text-[13px] leading-snug text-muted">{o.d}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>

          {selected === 'share' ? (
            <Field label="Dein Beitrag" htmlFor="amt" error={amountError}
              hint={rest !== null ? `Noch offen: ${formatCents(rest)}` : 'Kein Preis hinterlegt – frei wählbar.'}>
              <div className="relative">
                <Input id="amt" inputMode="decimal" className="pr-10 text-xl font-semibold" maxLength={14} value={amount}
                  onChange={(e) => setAmount(e.target.value)} invalid={!!amountError} />
                <span className="pointer-events-none absolute top-2.5 right-3.5 text-xl font-semibold text-muted" aria-hidden>€</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {chips.map((c) => (
                  <button key={c} type="button" onClick={() => setAmount(centsToInput(c))}
                    className="h-10 cursor-pointer rounded-full border border-line-2 bg-surface px-3.5 text-sm font-semibold text-ink">{formatCents(c, true)}</button>
                ))}
                {rest ? (
                  <button type="button" onClick={() => setAmount(centsToInput(rest))}
                    className="h-10 cursor-pointer rounded-full border border-line-2 bg-surface px-3.5 text-sm font-semibold text-ink">Rest {formatCents(rest, true)}</button>
                ) : null}
              </div>
            </Field>
          ) : null}

          {selected !== 'full' ? (
            <label className="flex min-h-11 items-center gap-3 text-[15px]">
              <input type="checkbox" className="size-5 accent-pine" checked={organizer} onChange={(e) => setOrganizer(e.target.checked)} />
              Ich kaufe &amp; bestelle das Geschenk
            </label>
          ) : null}

          <Field label="Notiz an Mitschenkende" htmlFor="nt" optional>
            <Input id="nt" maxLength={200} placeholder="z. B. Ich bestelle bis 1.12." value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <div className="flex items-center justify-center gap-2 text-[13px] font-medium text-pine-dark">
            <IconEyeOff size={16} /> {ownerName} sieht deine Zusage nicht.
          </div>
          <Button type="submit" loading={action.isPending}>
            {selected === 'full' ? 'Komplett beanspruchen'
              : selected === 'rest' ? `Rest übernehmen (${formatCents(rest ?? 0, true)})`
                : `Verbindlich ${cents ? formatCents(cents) : ''} zusagen`}
          </Button>
        </form>
      )}
    </Page>
  )
}
