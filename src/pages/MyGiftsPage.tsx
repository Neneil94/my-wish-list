import { Link } from '@tanstack/react-router'
import { Page } from '../components/AppShell'
import { Alert, Button, Card, EmptyState, Loading, Pill, SectionLabel } from '../components/ui'
import { IconCheck } from '../components/icons'
import { useClaimAction, useDismissNotice, useMyGifts, useNotices, type MyGift } from '../lib/api'
import { daysUntil, relativeDays } from '../lib/dates'
import { errorMessage } from '../lib/errors'
import { formatCents } from '../lib/money'

export function MyGiftsPage() {
  const gifts = useMyGifts()
  const notices = useNotices()
  const dismiss = useDismissNotice()
  const claimAction = useClaimAction()

  const list = gifts.data ?? []
  const open = list.filter((g) => !g.claim.purchased).length
  const total = list.reduce((s, g) => s + (g.claim.amount_cents ?? 0), 0)

  const byGroup = new Map<string, MyGift[]>()
  for (const g of list) {
    const key = g.wish.group?.id ?? 'none'
    byGroup.set(key, [...(byGroup.get(key) ?? []), g])
  }

  return (
    <Page>
      <div className="flex flex-col gap-1 pt-5 md:pt-0">
        <h1 className="m-0 text-3xl font-bold">Meine Geschenke</h1>
        <p className="m-0 text-[13px] text-muted">Was du zugesagt hast – nur für dich und Mitschenkende sichtbar.</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Card className="flex flex-col gap-0.5 p-3.5"><span className="font-display text-[26px] font-bold">{open}</span><span className="text-[13px] text-muted">noch nicht gekauft</span></Card>
        <Card className="flex flex-col gap-0.5 p-3.5"><span className="font-display text-[26px] font-bold">{formatCents(total)}</span><span className="text-[13px] text-muted">dein Anteil gesamt</span></Card>
      </div>

      {(notices.data ?? []).map((n) => (
        <Alert key={n.id} tone="warn">
          <div className="flex items-start justify-between gap-3">
            <span>{n.message}</span>
            <Button variant="ghost" size="sm" className="-my-1.5 shrink-0" onClick={() => dismiss.mutate(n.id)}>OK</Button>
          </div>
        </Alert>
      ))}

      {claimAction.error ? <Alert>{errorMessage(claimAction.error)}</Alert> : null}
      {gifts.isPending ? <Loading /> : null}
      {gifts.error ? <Alert>{errorMessage(gifts.error)}</Alert> : null}
      {gifts.isSuccess && list.length === 0 ? (
        <EmptyState title="Noch keine Zusagen">Öffne einen Anlass und beanspruche einen Wunsch aus der Liste einer anderen Person.</EmptyState>
      ) : null}

      {[...byGroup.values()].map((items) => {
        const group = items[0]!.wish.group
        return (
          <section key={group?.id ?? 'none'} className="flex flex-col gap-2.5">
            <SectionLabel>{group?.name ?? 'Anlass'}{group?.occasion_date ? ` · ${relativeDays(daysUntil(group.occasion_date))}` : ''}</SectionLabel>
            {items.map((g) => {
              const isGroup = g.claim.kind === 'share'
              const price = g.wish.price_cents
              return (
                <Card key={g.claim.id} className="flex flex-col gap-2 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13px] text-muted">für {g.ownerName}</span>
                      {group ? (
                        <Link to="/groups/$groupId/wishes/$wishId" params={{ groupId: group.id, wishId: g.wish.id }}
                          className="text-[15px] font-semibold text-ink no-underline hover:underline">{g.wish.title}</Link>
                      ) : <span className="text-[15px] font-semibold">{g.wish.title}</span>}
                    </div>
                    <Pill tone={isGroup ? 'apricot' : 'pine'}>{isGroup ? 'Gruppengeschenk' : 'Komplett'}</Pill>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink-2">
                      {isGroup
                        ? `Dein Anteil ${formatCents(g.claim.amount_cents ?? 0)}${price !== null ? ` · ${formatCents(g.coveredCents, true)} / ${formatCents(price, true)} gedeckt` : ''}`
                        : price !== null ? formatCents(price) : 'ohne Preis'}
                    </span>
                    <button type="button" aria-pressed={g.claim.purchased}
                      onClick={() => claimAction.mutate({ type: 'purchased', wishId: g.wish.id, purchased: !g.claim.purchased })}
                      className="flex min-h-11 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-sm font-medium text-ink">
                      <span className={`flex size-5.5 items-center justify-center rounded-md ${g.claim.purchased ? 'bg-pine text-white' : 'border-2 border-[#A8A49B] bg-surface text-transparent'}`}>
                        <IconCheck />
                      </span>
                      Gekauft
                    </button>
                  </div>
                </Card>
              )
            })}
          </section>
        )
      })}
    </Page>
  )
}
