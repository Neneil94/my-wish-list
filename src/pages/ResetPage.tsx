import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { PublicPage } from '../components/AppShell'
import { Alert, Button, Field, Input, PasswordInput, btn } from '../components/ui'
import { IconChevronLeft } from '../components/icons'
import { PasswordRules } from '../components/PasswordRules'
import { RecoveryCodeBox } from '../components/RecoveryCodeBox'
import { callAccount } from '../lib/account'
import { errorMessage } from '../lib/errors'
import { passwordOk } from '../lib/rules'

export function ResetPage() {
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newCode, setNewCode] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await callAccount<{ recoveryCode: string }>({
        action: 'reset-password', username, recoveryCode: code, newPassword: password,
      })
      setNewCode(res.recoveryCode)
      setPassword('')
      setCode('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (newCode) {
    return (
      <PublicPage>
        <h1 className="m-0 text-[32px] leading-tight font-bold">Passwort geändert</h1>
        <Alert tone="success">Dein alter Wiederherstellungscode ist jetzt ungültig. Hier ist dein neuer – bitte sicher aufbewahren:</Alert>
        <RecoveryCodeBox code={newCode} />
        <Link to="/login" className={btn('primary')}>Zum Login</Link>
      </PublicPage>
    )
  }

  return (
    <PublicPage>
      <div className="-mt-8 flex flex-col gap-5">
        <Link to="/login" aria-label="Zurück zum Login" className="-ml-2.5 inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-subtle">
          <IconChevronLeft />
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[32px] leading-tight font-bold">Passwort zurücksetzen</h1>
          <p className="m-0 text-[15px] text-muted">Mit dem Wiederherstellungscode, den du bei der Registrierung erhalten hast.</p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Username" htmlFor="u">
          <Input id="u" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={24}
            value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Wiederherstellungscode" htmlFor="rc" hint="Format: XXXXX-XXXXX-XXXXX-XXXXX">
          <Input id="rc" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40}
            className="font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="Neues Passwort" htmlFor="p">
          <PasswordInput id="p" autoComplete="new-password" maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <PasswordRules password={password} username={username} />
        <Button type="submit" loading={busy} disabled={!username || !code || !passwordOk(password, username)}>
          Passwort setzen
        </Button>
      </form>
    </PublicPage>
  )
}
