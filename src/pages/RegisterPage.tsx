import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { PublicPage } from '../components/AppShell'
import { Alert, Button, Field, Input, PasswordInput } from '../components/ui'
import { IconChevronLeft } from '../components/icons'
import { PasswordRules } from '../components/PasswordRules'
import { callAccount } from '../lib/account'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/errors'
import { passwordOk, usernameSchema } from '../lib/rules'
import { gate, recoveryCodeMemory } from '../lib/session-memory'

export function RegisterPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const accessCode = gate.code()
  const parsed = usernameSchema.safeParse(username)
  const usernameError = touched && !parsed.success ? parsed.error.issues[0]?.message ?? 'Ungültig' : null
  const repeatError = touched && repeat !== password ? 'Die Passwörter stimmen nicht überein.' : null
  const valid = parsed.success && passwordOk(password, username) && repeat === password

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!valid || !accessCode || !parsed.success) return
    setBusy(true)
    setError(null)
    try {
      const res = await callAccount<{ recoveryCode: string }>({
        action: 'register', accessCode, username: parsed.data, displayName: displayName || parsed.data, password,
      })
      recoveryCodeMemory.set(res.recoveryCode)
      await auth.signIn(parsed.data, password)
      await navigate({ to: '/recovery-code' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!accessCode) {
    return (
      <PublicPage>
        <h1 className="m-0 text-[32px] font-bold">Konto erstellen</h1>
        <Alert tone="warn">Zum Registrieren brauchst du das Zugangspasswort. Bitte gib es erneut ein.</Alert>
        <Link to="/gate" className="font-semibold">Zum Zugangspasswort</Link>
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
          <h1 className="m-0 text-[32px] leading-tight font-bold">Konto erstellen</h1>
          <p className="m-0 text-[15px] text-muted">Keine E-Mail nötig – nur Username und ein starkes Passwort.</p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Username" htmlFor="u" error={usernameError}
          hint="3–24 Zeichen: a–z, 0–9, Punkt, Unterstrich. Darüber laden dich andere ein.">
          <Input id="u" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={24}
            value={username} onChange={(e) => setUsername(e.target.value)} invalid={!!usernameError} />
        </Field>
        <Field label="Anzeigename" htmlFor="dn" optional hint="So sehen dich die anderen, z. B. „Oma Helga“.">
          <Input id="dn" autoComplete="nickname" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="Passwort" htmlFor="p">
          <PasswordInput id="p" autoComplete="new-password" maxLength={128} value={password}
            onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-rules" />
        </Field>
        <PasswordRules password={password} username={username} />
        <Field label="Passwort wiederholen" htmlFor="p2" error={repeatError}>
          <PasswordInput id="p2" autoComplete="new-password" maxLength={128} value={repeat}
            onChange={(e) => setRepeat(e.target.value)} invalid={!!repeatError} />
        </Field>
        <p className="m-0 text-[13px] leading-snug text-muted">
          Nach der Registrierung erhältst du einmalig einen <b>Wiederherstellungscode</b>. Bewahre ihn sicher auf –
          ohne E-Mail ist er der einzige Weg zurück ins Konto.
        </p>
        <Button type="submit" loading={busy} disabled={!valid}>Konto erstellen</Button>
      </form>
    </PublicPage>
  )
}
