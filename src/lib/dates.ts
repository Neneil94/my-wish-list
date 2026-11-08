const longFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function formatOccasionDate(iso: string | null): string {
  return iso ? longFmt.format(parseDate(iso)) : 'Ohne Datum'
}

/** Tage bis zum Datum (heute = 0, negativ = vergangen). */
export function daysUntil(iso: string | null, now = new Date()): number | null {
  if (!iso) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((parseDate(iso).getTime() - today.getTime()) / 86_400_000)
}

export function relativeDays(days: number | null): string {
  if (days === null) return ''
  if (days === 0) return 'heute'
  if (days === 1) return 'morgen'
  if (days > 1) return `in ${days} Tagen`
  return 'vergangen'
}
