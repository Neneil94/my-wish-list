import { describe, expect, it } from 'vitest'
import { checkPassword, passwordOk, safeHttpsUrl, usernameSchema, usernameToEmail } from './rules'
import { centsToInput, formatCents, parseEuroToCents } from './money'

describe('usernames', () => {
  it('normalisiert und validiert', () => {
    expect(usernameSchema.parse('  Dominik ')).toBe('dominik')
    expect(usernameSchema.safeParse('ab').success).toBe(false)
    expect(usernameSchema.safeParse('a b c').success).toBe(false)
    expect(usernameSchema.safeParse('x'.repeat(25)).success).toBe(false)
    expect(usernameSchema.safeParse('oma.helga_2').success).toBe(true)
    expect(usernameToEmail('Oma.Helga')).toBe('oma.helga@users.invalid')
  })
})

describe('passwords', () => {
  it('erzwingt Mindestanforderungen', () => {
    expect(passwordOk('kurz1', 'anna')).toBe(false)
    expect(passwordOk('nurbuchstabenlang', 'anna')).toBe(false)
    expect(passwordOk('anna-ist-toll-2026', 'anna')).toBe(false)
    expect(passwordOk('Tannenbaum-2026', 'anna')).toBe(true)
    expect(checkPassword('', 'anna').notUsername).toBe(false)
  })
})

describe('safeHttpsUrl', () => {
  it('akzeptiert nur https', () => {
    expect(safeHttpsUrl('https://example.com/a?b=c')).toBe('https://example.com/a?b=c')
    expect(safeHttpsUrl('http://example.com')).toBeNull()
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpsUrl('data:text/html,<script>')).toBeNull()
    expect(safeHttpsUrl('https://user:pw@example.com')).toBeNull()
    expect(safeHttpsUrl('https://exa mple.com')).toBeNull()
    expect(safeHttpsUrl('  ')).toBeNull()
  })
})

describe('money', () => {
  it('parst Eingaben', () => {
    expect(parseEuroToCents('')).toBeNull()
    expect(parseEuroToCents('160')).toBe(16000)
    expect(parseEuroToCents('160,5')).toBe(16050)
    expect(parseEuroToCents('1.299,99 €')).toBe(129999)
    expect(parseEuroToCents('12.50')).toBe(1250)
    expect(parseEuroToCents('-5')).toBeUndefined()
    expect(parseEuroToCents('abc')).toBeUndefined()
    expect(parseEuroToCents('1,234')).toBeUndefined()
  })
  it('formatiert', () => {
    expect(formatCents(19900, true)).toMatch(/^199\s€$/)
    expect(formatCents(8999)).toMatch(/^89,99\s€$/)
    expect(centsToInput(16000)).toBe('160,00')
    expect(centsToInput(null)).toBe('')
  })
})
