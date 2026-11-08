import type { Claim, Wish } from './types'

export type WishState = 'open' | 'group' | 'covered'

export interface WishSummary {
  state: WishState
  coveredCents: number
  contributors: number
  myClaim: Claim | null
  fullClaim: Claim | null
  /** Noch offener Betrag (nur bei Preis), sonst null. */
  remainingCents: number | null
}

export function summarize(wish: Wish, claims: Claim[], userId: string | null): WishSummary {
  const mine = claims.filter((c) => c.wish_id === wish.id)
  const coveredCents = mine.reduce((s, c) => s + (c.amount_cents ?? 0), 0)
  const fullClaim = mine.find((c) => c.kind === 'full') ?? null
  const myClaim = mine.find((c) => c.user_id === userId) ?? null
  const remainingCents = wish.price_cents === null ? null : Math.max(0, wish.price_cents - coveredCents)
  let state: WishState = 'open'
  if (fullClaim || (wish.price_cents !== null && mine.length > 0 && remainingCents === 0)) state = 'covered'
  else if (mine.length > 0) state = 'group'
  return { state, coveredCents, contributors: mine.length, myClaim, fullClaim, remainingCents }
}
