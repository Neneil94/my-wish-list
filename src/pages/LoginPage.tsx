import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Logo, PublicPage } from '../components/AppShell'
import { Alert, Button, Field, Input, PasswordInput, btn } from '../components/ui'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/errors'

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await auth.signIn(username, password)
      await navigate({ to: '/' })
    } catch (err) {
      setError(errorMessage(err))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicPage>
      <Logo />
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[34px] leading-tight font-bold">Willkommen zurück</h1>
        <p className="m-0 text-base text-muted">Melde dich mit deinem Username an.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4.5" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Username" htmlFor="u">
          <Input id="u" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username}
            onChange={(e) => setUsername(e.target.value)} required maxLength={24} />
        </Field>
        <Field label="Passwort" htmlFor="p">
          <PasswordInput id="p" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required maxLength={128} />
        </Field>
        <Button type="submit" loading={busy} disabled={!username || !password} className="mt-1.5">Anmelden</Button>
      </form>
      <div className="flex-1" />
      <div className="flex flex-col gap-3">
        <p className="m-0 text-center text-[13px] text-muted">Noch kein Konto?</p>
        <Link to="/register" className={btn('secondary')}>Konto erstellen</Link>
        <p className="m-0 text-center text-[13px] text-muted">
          Passwort vergessen? <Link to="/reset">Mit Wiederherstellungscode zurücksetzen</Link>
        </p>
      </div>
    </PublicPage>
  )
}
