import { argon2id, argon2Verify } from 'npm:hash-wasm@4.13.0'

// OWASP-Empfehlung (Password Storage Cheat Sheet): Argon2id, m=19 MiB, t=2, p=1
const ARGON = { parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32 } as const

export async function hashSecret(secret: string): Promise<string> {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  return await argon2id({ ...ARGON, password: secret, salt, outputType: 'encoded' })
}

export async function verifySecret(secret: string, encodedHash: string): Promise<boolean> {
  try {
    return await argon2Verify({ password: secret, hash: encodedHash })
  } catch {
    return false
  }
}

// Fester Dummy-Hash, damit unbekannte Usernamen gleich lange dauern (keine Enumeration).
let dummyHash: string | null = null
export async function burnTime(secret: string): Promise<void> {
  dummyHash ??= await hashSecret('dummy-secret-for-timing')
  await verifySecret(secret, dummyHash)
}

// Crockford-Base32 ohne verwechselbare Zeichen; 20 Zeichen ≈ 100 Bit Entropie.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (b) => ALPHABET[b & 31])
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join('')).join('-')
}

export function normalizeRecoveryCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const c = raw.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  if (!/^[0-9A-HJKMNP-TV-Z]{20}$/.test(c)) return null
  return [0, 5, 10, 15].map((i) => c.slice(i, i + 5)).join('-')
}

/** SHA-256 hex – für pseudonymisierte Rate-Limit-Schlüssel (keine Klar-IPs speichern). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Prüft per k-Anonymität gegen Have I Been Pwned, ob ein Passwort in Datenlecks
 * vorkommt. Nur die ersten 5 Zeichen des SHA-1-Hashes verlassen den Server.
 * Bei Netzwerkfehlern: "unbekannt" (null) – die übrigen Regeln greifen weiterhin.
 */
export async function isPwnedPassword(password: string): Promise<boolean | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password))
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const prefix = hex.slice(0, 5)
    const suffix = hex.slice(5)
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'my-wish-list-password-check' },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const body = await res.text()
    return body.split('\n').some((line) => {
      const [s, count] = line.trim().split(':')
      return s === suffix && Number(count) > 0
    })
  } catch {
    return null
  }
}
