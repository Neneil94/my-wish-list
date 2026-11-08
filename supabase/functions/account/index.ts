// Edge Function "account": alle Konto-Aktionen, die einen Server brauchen.
//
//   check-access     Zugangspasswort prüfen                     (öffentlich, rate-limitiert)
//   register         Konto anlegen – nur mit Zugangspasswort    (öffentlich, rate-limitiert)
//   reset-password   Passwort per Wiederherstellungscode setzen (öffentlich, rate-limitiert)
//   change-password  Passwort ändern (aktuelles nötig)          (eingeloggt)
//   rotate-recovery  neuen Wiederherstellungscode erzeugen      (eingeloggt, Passwort nötig)
//
// Öffentliche Registrierung ist im Supabase-Dashboard deaktiviert; Konten
// entstehen ausschließlich hier über die Admin-API (service_role).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import { cleanDisplayName, normalizeUsername, passwordProblem, usernameToEmail } from '../_shared/rules.ts'
import {
  burnTime, generateRecoveryCode, hashSecret, isPwnedPassword,
  normalizeRecoveryCode, sha256Hex, verifySecret,
} from '../_shared/security.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const ACCESS_CODE_HASH = Deno.env.get('ACCESS_CODE_HASH') ?? ''
const RATE_LIMIT_SALT = Deno.env.get('RATE_LIMIT_SALT') ?? ''
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map((o) => o.trim()).filter(Boolean)

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/**
 * Client-IP für Rate-Limits. Der ERSTE Eintrag von X-Forwarded-For ist vom Client
 * frei wählbar (Proxys hängen nur hinten an) und daher ungeeignet.
 *   1. cf-connecting-ip: setzt Cloudflare selbst, überschreibt Client-Werte.
 *   2. sonst der LETZTE X-Forwarded-For-Eintrag (vom nächstgelegenen Proxy angehängt).
 * Trotzdem nur "best effort" – die globalen Limits unten sind nicht umgehbar.
 */
function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const parts = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return parts.at(-1) ?? 'unknown'
}

// Globale Obergrenzen (unabhängig von der IP, also nicht durch IP-Wechsel umgehbar).
// Ein Angreifer kann damit höchstens die Zugangsprüfung kurzzeitig für alle sperren,
// aber das Zugangspasswort nicht in großem Stil durchprobieren.
const GLOBAL_ACCESS_FAILURES = 30 // pro 15 Minuten
const GLOBAL_REGISTRATIONS = 30 // pro 24 Stunden

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Meldet ALLE Sessions eines Nutzers ab (Refresh-Tokens werden ungültig).
 * Die Admin-API kann Sessions nur über ein JWT des Nutzers beenden – daher
 * kurz mit dem (neuen) Passwort anmelden und dann global abmelden.
 */
async function revokeAllSessions(username: string, password: string): Promise<void> {
  const { data, error } = await anonClient().auth.signInWithPassword({
    email: usernameToEmail(username), password,
  })
  if (error || !data.session) throw new HttpError(500, 'server_error')
  const { error: signOutError } = await admin.auth.admin.signOut(data.session.access_token, 'global')
  if (signOutError) throw new HttpError(500, 'server_error')
}

function checkAccess(ip: string, code: unknown): Promise<void> {
  return limitFailures('access:global', GLOBAL_ACCESS_FAILURES, 15 * 60, () =>
    limitFailures(`access:${ip}`, 5, 15 * 60, () => checkAccessCode(code)))
}

async function limit(key: string, max: number, windowSeconds: number): Promise<void> {
  const hashed = await sha256Hex(`${RATE_LIMIT_SALT}:${key}`)
  const { data, error } = await admin.rpc('rate_limit_hit', {
    p_key: hashed, p_max: max, p_window_seconds: windowSeconds,
  })
  if (error) throw new HttpError(500, 'server_error')
  if (data !== true) throw new HttpError(429, 'too_many_attempts')
}

/**
 * Zählt nur FEHLversuche (401) gegen das Limit, damit z. B. mehrere Familienmitglieder
 * im selben WLAN sich nacheinander registrieren können.
 */
async function limitFailures<T>(key: string, max: number, windowSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hashed = await sha256Hex(`${RATE_LIMIT_SALT}:${key}`)
  const { data: blocked, error } = await admin.rpc('rate_limit_blocked', {
    p_key: hashed, p_max: max, p_window_seconds: windowSeconds,
  })
  if (error) throw new HttpError(500, 'server_error')
  if (blocked === true) throw new HttpError(429, 'too_many_attempts')
  try {
    return await fn()
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      await admin.rpc('rate_limit_hit', { p_key: hashed, p_max: max, p_window_seconds: windowSeconds })
    }
    throw e
  }
}

async function checkAccessCode(code: unknown): Promise<void> {
  if (!ACCESS_CODE_HASH) throw new HttpError(500, 'server_misconfigured')
  if (typeof code !== 'string' || code.length < 1 || code.length > 200) {
    throw new HttpError(401, 'access_denied')
  }
  if (!(await verifySecret(code, ACCESS_CODE_HASH))) throw new HttpError(401, 'access_denied')
}

async function assertGoodPassword(password: unknown, username: string): Promise<string> {
  const problem = passwordProblem(password, username)
  if (problem) throw new HttpError(400, problem)
  if ((await isPwnedPassword(password as string)) === true) throw new HttpError(400, 'password_pwned')
  return password as string
}

async function storeNewRecoveryCode(userId: string): Promise<string> {
  const code = generateRecoveryCode()
  const { error } = await admin.from('recovery_codes').upsert({
    user_id: userId, code_hash: await hashSecret(code), created_at: new Date().toISOString(),
  })
  if (error) throw new HttpError(500, 'server_error')
  return code
}

/** Prüft das JWT und das aktuelle Passwort des eingeloggten Nutzers. */
async function reauthenticate(req: Request, password: unknown): Promise<{ id: string; username: string; jwt: string }> {
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user) throw new HttpError(401, 'not_authenticated')
  const user = data.user
  const { data: profile } = await admin.from('profiles').select('username').eq('id', user.id).single()
  if (!profile) throw new HttpError(401, 'not_authenticated')
  await limitFailures(`reauth:${user.id}`, 5, 15 * 60, async () => {
    if (typeof password !== 'string' || password.length > 200) throw new HttpError(401, 'wrong_password')
    const anon = anonClient()
    const { error: signInError } = await anon.auth.signInWithPassword({
      email: usernameToEmail(profile.username), password,
    })
    if (signInError) throw new HttpError(401, 'wrong_password')
    await anon.auth.signOut({ scope: 'local' })
  })
  return { id: user.id, username: profile.username, jwt }
}

async function resetPassword(username: string | null, code: string | null, newPassword: unknown): Promise<unknown> {
  const { data: profile } = username
    ? await admin.from('profiles').select('id').eq('username', username).maybeSingle()
    : { data: null }
  const { data: stored } = profile
    ? await admin.from('recovery_codes').select('code_hash').eq('user_id', profile.id).maybeSingle()
    : { data: null }
  if (!profile || !stored || !code || !username) {
    await burnTime(code ?? 'x') // gleiche Laufzeit wie bei existierendem Nutzer
    throw new HttpError(401, 'reset_denied')
  }
  if (!(await verifySecret(code, stored.code_hash))) throw new HttpError(401, 'reset_denied')
  const password = await assertGoodPassword(newPassword, username)
  const { error } = await admin.auth.admin.updateUserById(profile.id, { password })
  if (error) throw new HttpError(500, 'server_error')
  // Wer das Konto vorher übernommen hatte, fliegt raus. Schlägt das fehl, bleibt
  // der alte Code gültig (er wird erst danach ersetzt) – der Reset kann wiederholt werden.
  await revokeAllSessions(username, password)
  // Code ist verbraucht → sofort einen neuen ausgeben.
  return { recoveryCode: await storeNewRecoveryCode(profile.id) }
}

async function handle(req: Request, body: Record<string, unknown>): Promise<unknown> {
  const ip = clientIp(req)

  switch (body.action) {
    case 'check-access': {
      await checkAccess(ip, body.accessCode)
      return { ok: true }
    }

    case 'register': {
      await checkAccess(ip, body.accessCode)
      await limit(`register:${ip}`, 20, 24 * 60 * 60)
      await limit('register:global', GLOBAL_REGISTRATIONS, 24 * 60 * 60)
      const username = normalizeUsername(body.username)
      if (!username) throw new HttpError(400, 'username_invalid')
      const password = await assertGoodPassword(body.password, username)
      const displayName = cleanDisplayName(body.displayName, username)

      const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
      if (existing) throw new HttpError(409, 'username_taken')

      const { data: created, error } = await admin.auth.admin.createUser({
        email: usernameToEmail(username), password, email_confirm: true,
        user_metadata: { username },
      })
      if (error || !created.user) {
        const code = (error as { code?: string } | null)?.code
        if (code === 'email_exists' || code === 'user_already_exists') throw new HttpError(409, 'username_taken')
        if (code === 'weak_password') throw new HttpError(400, 'password_too_simple')
        console.error('createUser failed', code ?? error?.status)
        throw new HttpError(500, 'server_error')
      }
      const { error: profileError } = await admin.from('profiles').insert({
        id: created.user.id, username, display_name: displayName,
      })
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id)
        throw new HttpError(profileError.code === '23505' ? 409 : 500,
          profileError.code === '23505' ? 'username_taken' : 'server_error')
      }
      return { recoveryCode: await storeNewRecoveryCode(created.user.id) }
    }

    case 'reset-password': {
      const username = normalizeUsername(body.username)
      const code = normalizeRecoveryCode(body.recoveryCode)
      return await limitFailures(`reset:${ip}`, 5, 60 * 60, () =>
        limitFailures(`reset-user:${username ?? '-'}`, 5, 60 * 60, () => resetPassword(username, code, body.newPassword)))
    }

    case 'change-password': {
      const user = await reauthenticate(req, body.currentPassword)
      const password = await assertGoodPassword(body.newPassword, user.username)
      const { error } = await admin.auth.admin.updateUserById(user.id, { password })
      if (error) throw new HttpError(500, 'server_error')
      // Alle ANDEREN Geräte abmelden; die aktuelle Session bleibt bestehen.
      const { error: signOutError } = await admin.auth.admin.signOut(user.jwt, 'others')
      if (signOutError) {
        console.error('signOut others failed', signOutError.status)
        throw new HttpError(500, 'server_error')
      }
      return { ok: true }
    }

    case 'rotate-recovery': {
      const user = await reauthenticate(req, body.currentPassword)
      return { recoveryCode: await storeNewRecoveryCode(user.id) }
    }

    default:
      throw new HttpError(400, 'unknown_action')
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin)
  // Browser-Anfragen nur von erlaubten Origins.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: 'origin_not_allowed' }, 403, origin)

  const raw = await req.text()
  if (raw.length > 4096) return json({ error: 'payload_too_large' }, 413, origin)
  let body: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error()
    body = parsed
  } catch {
    return json({ error: 'invalid_json' }, 400, origin)
  }

  try {
    return json(await handle(req, body), 200, origin)
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status, origin)
    console.error('account function error', e instanceof Error ? e.message : 'unknown')
    return json({ error: 'server_error' }, 500, origin)
  }
})
