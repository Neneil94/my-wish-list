// Gemeinsame Validierungsregeln für die Edge Function.
// WICHTIG: inhaltlich synchron halten mit src/lib/rules.ts (Frontend).

export const USERNAME_RE = /^[a-z0-9_.]{3,24}$/
export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 128
export const DISPLAY_NAME_MAX = 40

/** Interne Pseudo-Adresse für Supabase Auth – Nutzer sehen sie nie. */
export const EMAIL_DOMAIN = 'users.invalid'

export function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const u = raw.trim().toLowerCase()
  return USERNAME_RE.test(u) ? u : null
}

export function usernameToEmail(username: string): string {
  return `${username}@${EMAIL_DOMAIN}`
}

/** Gibt einen Fehlercode zurück oder null, wenn das Passwort die Regeln erfüllt. */
export function passwordProblem(password: unknown, username: string): string | null {
  if (typeof password !== 'string') return 'password_invalid'
  if (password.length < PASSWORD_MIN) return 'password_too_short'
  if (password.length > PASSWORD_MAX) return 'password_too_long'
  if (password.toLowerCase().includes(username.toLowerCase())) return 'password_contains_username'
  if (!/[A-Za-zÄÖÜäöüß]/.test(password) || !/[^A-Za-zÄÖÜäöüß]/.test(password)) return 'password_too_simple'
  return null
}

export function cleanDisplayName(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const d = raw.trim().replace(/\s+/g, ' ')
  if (d.length === 0) return fallback
  return d.slice(0, DISPLAY_NAME_MAX)
}
