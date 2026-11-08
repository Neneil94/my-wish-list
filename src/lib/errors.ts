// Übersetzt Fehlercodes aus RPCs/Edge Function in verständliche Meldungen.
// Interne Details (SQL, Stacktraces) werden nie angezeigt.

const MESSAGES: Record<string, string> = {
  access_denied: 'Das Zugangspasswort ist nicht korrekt.',
  too_many_attempts: 'Zu viele Versuche. Bitte warte etwas und versuche es dann erneut.',
  username_invalid: 'Der Username ist ungültig (3–24 Zeichen: a–z, 0–9, Punkt, Unterstrich).',
  username_taken: 'Dieser Username ist bereits vergeben.',
  password_too_short: 'Das Passwort muss mindestens 12 Zeichen lang sein.',
  password_too_long: 'Das Passwort ist zu lang (max. 128 Zeichen).',
  password_contains_username: 'Das Passwort darf den Username nicht enthalten.',
  password_too_simple: 'Das Passwort braucht Buchstaben und Zahlen oder Sonderzeichen.',
  password_pwned: 'Dieses Passwort ist aus Datenlecks bekannt. Bitte wähle ein anderes.',
  password_invalid: 'Das Passwort ist ungültig.',
  reset_denied: 'Username oder Wiederherstellungscode ist falsch.',
  wrong_password: 'Das aktuelle Passwort ist falsch.',
  not_authenticated: 'Bitte melde dich erneut an.',
  invalid_credentials: 'Username oder Passwort ist falsch.',
  user_not_found: 'Kein Konto mit diesem Username gefunden.',
  already_member: 'Diese Person ist bereits Mitglied oder eingeladen.',
  group_full: 'Dieser Anlass hat die maximale Mitgliederzahl erreicht.',
  invite_not_found: 'Diese Einladung gibt es nicht mehr.',
  forbidden: 'Dafür fehlen dir die Rechte.',
  last_admin: 'Es muss mindestens einen Admin geben.',
  cannot_claim_own_wish: 'Eigene Wünsche kannst du nicht beanspruchen.',
  already_claimed: 'Dieser Wunsch wurde gerade komplett vergeben.',
  group_gift_in_progress: 'Hier läuft bereits ein Gruppengeschenk – du kannst mitmachen.',
  exceeds_price: 'Der Betrag ist höher als der noch offene Rest.',
  invalid_amount: 'Bitte gib einen gültigen Betrag an.',
  claim_not_found: 'Diese Zusage gibt es nicht mehr.',
  too_many_wishes: 'Maximal 100 Wünsche pro Liste.',
  origin_not_allowed: 'Diese Seite ist für den Server nicht freigeschaltet.',
  server_misconfigured: 'Der Server ist noch nicht vollständig eingerichtet.',
}

export class AppError extends Error {
  constructor(readonly code: string) {
    super(MESSAGES[code] ?? 'Etwas ist schiefgelaufen. Bitte versuche es erneut.')
  }
}

/** Liest einen bekannten Fehlercode aus beliebigen Fehlerobjekten. */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : ''
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
  if (code === '23514' || code === '22P02' || code === '22001') return new AppError('validation')
  const known = Object.keys(MESSAGES).find((k) => msg === k || msg.includes(k))
  return new AppError(known ?? 'unknown')
}

export function errorMessage(e: unknown): string {
  const err = toAppError(e)
  return err.code === 'validation' ? 'Bitte prüfe deine Eingaben.' : err.message
}
