#!/usr/bin/env node
// Erzeugt den Argon2id-Hash für das Zugangspasswort (Secret ACCESS_CODE_HASH).
// Das Passwort wird verdeckt abgefragt und landet nicht in der Shell-History.
//
//   node scripts/hash-access-code.mjs
//       → gibt nur den Hash aus
//   node scripts/hash-access-code.mjs --out supabase/functions/.env.production [--origin https://user.github.io]
//       → schreibt eine fertige Secrets-Datei (Hash, zufälliger Salt, erlaubte Origin), Rechte 600
import { argon2id } from 'hash-wasm'
import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'

function arg(name) {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : undefined
}
const outFile = arg('--out')
const origin = arg('--origin') ?? 'https://neneil94.github.io'

if (outFile && existsSync(outFile)) {
  console.error(`${outFile} existiert bereits – bitte erst löschen, wenn du sie neu erzeugen willst.`)
  process.exit(1)
}
if (!/^https:\/\/[a-z0-9.-]+$/i.test(origin)) {
  console.error('--origin muss eine https-Origin ohne Pfad sein, z. B. https://neneil94.github.io')
  process.exit(1)
}

/** Liest eine Eingabe im Raw-Modus Zeichen für Zeichen – ohne jedes Echo. */
function ask(question) {
  if (!process.stdin.isTTY) {
    console.error('Bitte in einem interaktiven Terminal ausführen (keine Weiterleitung von stdin).')
    process.exit(1)
  }
  return new Promise((resolve) => {
    process.stdout.write(question)
    const stdin = process.stdin
    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (ch === '\u0003') { // Ctrl-C
          stdin.setRawMode(false)
          process.stdout.write('\n')
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else if (ch >= ' ') value += ch
      }
    }
    stdin.on('data', onData)
  })
}

const code = await ask('Zugangspasswort: ')
if (code.length < 12) {
  console.error('Bitte mindestens 12 Zeichen verwenden.')
  process.exit(1)
}
const again = await ask('Wiederholen: ')
if (code !== again) {
  console.error('Eingaben stimmen nicht überein.')
  process.exit(1)
}
const hash = await argon2id({
  password: code, salt: randomBytes(16), parallelism: 1, iterations: 2,
  memorySize: 19456, hashLength: 32, outputType: 'encoded',
})

if (outFile) {
  const content = [
    '# Secrets für die Edge Function "account" – NICHT committen.',
    `ACCESS_CODE_HASH='${hash}'`,
    `RATE_LIMIT_SALT=${randomBytes(32).toString('hex')}`,
    `ALLOWED_ORIGINS=${origin}`,
    '',
  ].join('\n')
  writeFileSync(outFile, content, { mode: 0o600 })
  console.log(`Geschrieben: ${outFile} (Origin: ${origin})`)
} else {
  console.log('\nACCESS_CODE_HASH (als Secret hinterlegen, siehe README):\n')
  console.log(`'${hash}'`)
  console.log('\n(In der .env-Datei mit einfachen Anführungszeichen speichern, sonst wird $ ersetzt.)')
}
