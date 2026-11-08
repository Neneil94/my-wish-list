import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { PublicPage } from '../components/AppShell'
import { Alert, Button, Field, PasswordInput } from '../components/ui'
import { IconGift, IconLock } from '../components/icons'
import { callAccount } from '../lib/account'
import { errorMessage } from '../lib/errors'
import { gate } from '../lib/session-memory'

export function GatePage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!code) return
    setBusy(true)
    setError(null)
    try {
      await callAccount({ action: 'check-access', accessCode: code })
      gate.pass(code)
      await navigate({ to: '/login' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicPage>
      <div className="flex flex-col gap-5 pt-6">
        <span className="flex size-16 items-center justify-center rounded-[18px] bg-pine text-white"><IconGift size={32} /></span>
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 text-[34px] leading-tight font-bold">Privater Bereich</h1>
          <p className="m-0 text-base text-muted">Gib das Zugangspasswort ein, das du von der Familie bekommen hast.</p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Zugangspasswort" htmlFor="code" hint="Nach 5 Fehlversuchen ist die Eingabe 15 Minuten gesperrt.">
          <PasswordInput id="code" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={200} />
        </Field>
        <Button type="submit" loading={busy} disabled={!code}>Weiter</Button>
      </form>
      <div className="flex-1" />
      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3.5 text-[13px] text-muted">
        <IconLock size={20} className="mt-px shrink-0 text-pine" />
        Diese Seite ist nicht öffentlich und wird von Suchmaschinen nicht indexiert.
      </div>
    </PublicPage>
  )
}
