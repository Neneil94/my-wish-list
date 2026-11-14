import { Link } from '@tanstack/react-router'
import { Pill, ProgressBar, btn } from './ui'
import { WishCardImage, WishThumb } from './WishImage'
import { formatCents } from '../lib/money'
import { urlHost } from '../lib/rules'
import type { WishSummary } from '../lib/wishStatus'
import type { Wish } from '../lib/types'

/** Wunsch aus Sicht einer schenkenden Person (mit Claim-Status). */
export function GiverWishCard({ wish, s, groupId, claimerName }: {
  wish: Wish; s: WishSummary; groupId: string; claimerName: string | null
}) {
  const meta = [
    wish.price_cents !== null ? formatCents(wish.price_cents, true) : 'ohne Preis',
    wish.priority === 'top' ? 'Top-Wunsch' : null,
    wish.url ? urlHost(wish.url) : null,
  ].filter(Boolean).join(' · ')

  let pill: { tone: 'apricot' | 'neutral' | 'pine' | 'muted'; text: string }
  if (s.myClaim) pill = { tone: 'pine', text: s.state === 'group' ? 'Du bist dabei' : 'Von dir' }
  else if (s.state === 'covered') pill = { tone: 'muted', text: claimerName ? `Vergeben · ${claimerName}` : 'Vergeben' }
  else if (s.state === 'group') pill = { tone: 'apricot', text: 'Gruppengeschenk' }
  else pill = { tone: 'neutral', text: 'Offen' }

  const params = { groupId, wishId: wish.id }
  return (
    <article className="flex flex-col gap-2.5 overflow-hidden rounded-2xl border border-line bg-surface px-4 py-3.5">
      {/* Desktop-Raster: Bild als Kopf der Karte. */}
      {wish.image_path ? <div className="hidden md:block"><WishCardImage path={wish.image_path} /></div> : null}
      <div className="flex items-start gap-3">
        {/* Mobil: Vorschaubild links, Status unter dem Titel. */}
        <div className="md:hidden"><WishThumb path={wish.image_path} /></div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link to="/groups/$groupId/wishes/$wishId" params={params}
            className="text-[15px] leading-snug font-semibold text-ink no-underline hover:underline">{wish.title}</Link>
          <span className="text-[13px] text-muted">{meta}</span>
          <span className="mt-0.5 md:hidden"><Pill tone={pill.tone}>{pill.text}</Pill></span>
        </div>
        <span className="hidden md:inline-flex"><Pill tone={pill.tone}>{pill.text}</Pill></span>
      </div>
      {s.state === 'group' ? (
        <div className="flex flex-col gap-1.5">
          <ProgressBar value={wish.price_cents ? s.coveredCents / wish.price_cents : 0.5} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-muted">
              {wish.price_cents !== null
                ? `${formatCents(s.coveredCents, true)} von ${formatCents(wish.price_cents, true)}`
                : `${formatCents(s.coveredCents, true)} gesammelt`} · {s.contributors} {s.contributors === 1 ? 'Person' : 'Personen'}
            </span>
            {!s.myClaim ? <Link to="/groups/$groupId/wishes/$wishId/claim" params={params} className={btn('accent', 'sm')}>Mitmachen</Link> : null}
          </div>
        </div>
      ) : null}
      {s.state === 'open' ? (
        <div className="flex justify-end">
          <Link to="/groups/$groupId/wishes/$wishId/claim" params={params} className={btn('primary', 'sm')}>Beanspruchen</Link>
        </div>
      ) : null}
    </article>
  )
}
