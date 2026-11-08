#!/usr/bin/env node
// Erzeugt den Argon2id-Hash für das Zugangspasswort (Secret ACCESS_CODE_HASH).
// Das Passwort wird verdeckt abgefragt und landet nicht in der Shell-History.
import { argon2id } from 'hash-wasm'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s) }
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer) })
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
console.log('\nACCESS_CODE_HASH (als Secret hinterlegen, siehe README):\n')
console.log(`'${hash}'`)
console.log('\n(In der .env-Datei mit einfachen Anführungszeichen speichern, sonst wird $ ersetzt.)')
