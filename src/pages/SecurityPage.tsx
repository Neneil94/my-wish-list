import { useState, type FormEvent } from 'react'
import { Page } from '../components/AppShell'
import { Alert, BackHeader, Button, Card, Field, PasswordInput } from '../components/ui'
import { PasswordRules } from '../components/PasswordRules'
import { RecoveryCodeBox } from '../components/RecoveryCodeBox'
import { callAccount } from '../lib/account'
import { useMyProfile } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { passwordOk } from '../lib/rules'

export function SecurityPage() {
  const profile = useMyProfile()
  const username = profile.data?.username ?? ''

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  const [rcPassword, setRcPassword] = useState('')
  const [rcBusy, setRcBusy] = useState(false)
  const [rcError, setRcError] = useState<string | null>(null)
  const [rcCode, setRcCode] = useState<string | null>(null)

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    setPwBusy(true)
    setPwMsg(null)
    try {
      await callAccount({ action: 'change-password', currentPassword: current, newPassword: next })
      setPwMsg({ ok: true, text: 'Dein Passwort wurde geändert.' })
      setCurrent(''); setNext(''); setRepeat('')
    } catch (err) {
      setPwMsg({ ok: false, text: errorMessage(err) })
    } finally {
      setPwBusy(false)
    }
  }

  async function rotate(e: FormEvent) {
    e.preventDefault()
    setRcBusy(true)
    setRcError(null)
    try {
      const res = await callAccount<{ recoveryCode: string }>({ action: 'rotate-recovery', currentPassword: rcPassword })
      setRcCode(res.recoveryCode)
      setRcPassword('')
    } catch (err) {
      setRcError(errorMessage(err))
    } finally {
      setRcBusy(false)
    }
  }

  return (
    <Page>
      <BackHeader to="/profile" label="Zurück zum Profil" title="Sicherheit" />

      <Card className="p-4">
        <form onSubmit={changePassword} className="flex flex-col gap-4" noValidate>
          <h2 className="m-0 text-xl font-bold">Passwort ändern</h2>
          {pwMsg ? <Alert tone={pwMsg.ok ? 'success' : 'error'}>{pwMsg.text}</Alert> : null}
          <Field label="Aktuelles Passwort" htmlFor="cur">
            <PasswordInput id="cur" autoComplete="current-password" maxLength={128} value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="Neues Passwort" htmlFor="new">
            <PasswordInput id="new" autoComplete="new-password" maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <PasswordRules password={next} username={username} />
          <Field label="Neues Passwort wiederholen" htmlFor="rep" error={repeat && repeat !== next ? 'Die Passwörter stimmen nicht überein.' : null}>
            <PasswordInput id="rep" autoComplete="new-password" maxLength={128} value={repeat} onChange={(e) => setRepeat(e.target.value)} invalid={!!repeat && repeat !== next} />
          </Field>
          <Button type="submit" size="md" loading={pwBusy} disabled={!current || !passwordOk(next, username) || next !== repeat}>
            Passwort ändern
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <form id="recovery" onSubmit={rotate} className="flex scroll-mt-6 flex-col gap-4" noValidate>
          <h2 className="m-0 text-xl font-bold">Wiederherstellungscode erneuern</h2>
          <p className="m-0 text-sm text-ink-2">Der bisherige Code wird dabei ungültig. Den neuen siehst du nur einmal.</p>
          {rcError ? <Alert>{rcError}</Alert> : null}
          {rcCode ? <RecoveryCodeBox code={rcCode} /> : (
            <>
              <Field label="Aktuelles Passwort" htmlFor="rcpw">
                <PasswordInput id="rcpw" autoComplete="current-password" maxLength={128} value={rcPassword} onChange={(e) => setRcPassword(e.target.value)} />
              </Field>
              <Button type="submit" size="md" variant="secondary" loading={rcBusy} disabled={!rcPassword}>Neuen Code erzeugen</Button>
            </>
          )}
        </form>
      </Card>
    </Page>
  )
}
