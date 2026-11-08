const fmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const fmtShort = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

/** Cent → "199,00 €" bzw. "199 €" wenn glatt und short=true. */
export function formatCents(cents: number, short = false): string {
  const euros = cents / 100
  return short && cents % 100 === 0 ? fmtShort.format(euros) : fmt.format(euros)
}

/**
 * Parst deutsche/englische Betragseingaben ("1.299,50", "12,5", "12.50", "12 €")
 * in Cent. Leer → null (= kein Preis). Ungültig → undefined.
 */
export function parseEuroToCents(raw: string): number | null | undefined {
  const s = raw.replace(/€/g, '').replace(/\s/g, '').trim()
  if (s === '') return null
  let normalized: string
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) normalized = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d+(,\d{1,2})?$/.test(s)) normalized = s.replace(',', '.')
  else if (/^\d+(\.\d{1,2})?$/.test(s)) normalized = s
  else return undefined
  const cents = Math.round(Number(normalized) * 100)
  if (!Number.isFinite(cents) || cents < 0 || cents > 100_000_000) return undefined
  return cents
}

export function centsToInput(cents: number | null): string {
  if (cents === null) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}
