// Validierungsregeln – inhaltlich synchron halten mit supabase/functions/_shared/rules.ts
import { z } from 'zod'

export const USERNAME_RE = /^[a-z0-9_.]{3,24}$/
export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 128
export const EMAIL_DOMAIN = 'users.invalid'

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(z.string().regex(USERNAME_RE, '3–24 Zeichen: a–z, 0–9, Punkt oder Unterstrich.'))

export interface PasswordChecks {
  length: boolean
  notUsername: boolean
  mixed: boolean
}

export function checkPassword(password: string, username: string): PasswordChecks {
  const u = normalizeUsername(username)
  return {
    length: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    notUsername: password.length > 0 && (u.length === 0 || !password.toLowerCase().includes(u)),
    mixed: /[A-Za-zÄÖÜäöüß]/.test(password) && /[^A-Za-zÄÖÜäöüß]/.test(password),
  }
}

export function passwordOk(password: string, username: string): boolean {
  const c = checkPassword(password, username)
  return c.length && c.notUsername && c.mixed
}

/** 0–4, nur zur Anzeige. */
export function passwordStrength(password: string, username: string): number {
  if (!password) return 0
  const c = checkPassword(password, username)
  let score = [c.length, c.notUsername, c.mixed].filter(Boolean).length
  if (c.length && password.length >= 16 && /[^A-Za-z0-9]/.test(password)) score += 1
  return Math.min(score, 4)
}

/** Nur https-Links ohne Steuer-/Leerzeichen; gibt die normalisierte URL oder null zurück. */
export function safeHttpsUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s || s.length > 2000 || /[\s<>"]/.test(s)) return null
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return null
    return u.toString()
  } catch {
    return null
  }
}

export function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export const groupSchema = z.object({
  name: z.string().trim().min(1, 'Bitte einen Namen angeben.').max(60, 'Höchstens 60 Zeichen.'),
  occasionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
  description: z.string().trim().max(500, 'Höchstens 500 Zeichen.'),
  mode: z.enum(['all', 'some']),
})

export const wishSchema = z.object({
  title: z.string().trim().min(1, 'Bitte einen Titel angeben.').max(80, 'Höchstens 80 Zeichen.'),
  url: z.string().trim().refine((v) => v === '' || safeHttpsUrl(v) !== null, 'Nur sichere https://-Links sind erlaubt.'),
  description: z.string().trim().max(500, 'Höchstens 500 Zeichen.'),
  price: z.string().trim(),
  priority: z.enum(['normal', 'top']),
})
