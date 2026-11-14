import { describe, expect, it } from 'vitest'
import { IMAGE_PATH_RE, MAX_INPUT_BYTES, checkImageFile, fitWithin, imagePath, isHeic, thumbPathOf } from './wishImage'

const G = '11111111-1111-1111-1111-111111111111'
const W = '22222222-2222-2222-2222-222222222222'
const I = '33333333-3333-3333-3333-333333333333'

describe('checkImageFile', () => {
  it('akzeptiert gängige Bildformate', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) {
      expect(checkImageFile({ type, name: 'x', size: 1000 })).toBeNull()
    }
  })
  it('erkennt HEIC auch ohne MIME-Typ an der Endung', () => {
    expect(checkImageFile({ type: '', name: 'IMG_0001.HEIC', size: 1000 })).toBeNull()
    expect(isHeic({ type: '', name: 'foto.heif' })).toBe(true)
  })
  it('lehnt andere Dateien ab', () => {
    expect(checkImageFile({ type: 'application/pdf', name: 'a.pdf', size: 10 })).toBe('image_type')
    expect(checkImageFile({ type: 'image/svg+xml', name: 'a.svg', size: 10 })).toBe('image_type')
    expect(checkImageFile({ type: 'image/gif', name: 'a.gif', size: 10 })).toBe('image_type')
  })
  it('lehnt zu große Dateien ab', () => {
    expect(checkImageFile({ type: 'image/jpeg', name: 'a.jpg', size: MAX_INPUT_BYTES + 1 })).toBe('image_too_large')
    expect(checkImageFile({ type: 'image/jpeg', name: 'a.jpg', size: MAX_INPUT_BYTES })).toBeNull()
  })
})

describe('fitWithin', () => {
  it('verkleinert proportional an der längeren Kante', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
  })
  it('vergrößert nie', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
  it('bleibt bei extremen Seitenverhältnissen mindestens 1 px', () => {
    expect(fitWithin(10000, 2, 480)).toEqual({ width: 480, height: 1 })
  })
})

describe('Pfade', () => {
  it('baut gültige Pfade passend zur Datenbank-Regel', () => {
    const p = imagePath(G, W, I, 'webp')
    expect(p).toBe(`${G}/${W}/${I}.webp`)
    expect(IMAGE_PATH_RE.test(p)).toBe(true)
    expect(IMAGE_PATH_RE.test(imagePath(G, W, I, 'jpg'))).toBe(true)
  })
  it('leitet den Vorschau-Pfad ab', () => {
    expect(thumbPathOf(`${G}/${W}/${I}.webp`)).toBe(`${G}/${W}/${I}-thumb.webp`)
    expect(thumbPathOf(`${G}/${W}/${I}.jpg`)).toBe(`${G}/${W}/${I}-thumb.jpg`)
  })
  it('akzeptiert keine Vorschau- oder fremden Pfade als Bild', () => {
    expect(IMAGE_PATH_RE.test(thumbPathOf(imagePath(G, W, I, 'webp')))).toBe(false)
    expect(IMAGE_PATH_RE.test(`${G}/${W}/../${I}.webp`)).toBe(false)
    expect(IMAGE_PATH_RE.test(`${G}/${W}/${I}.png`)).toBe(false)
  })
})
