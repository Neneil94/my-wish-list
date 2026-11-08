import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Page } from '../components/AppShell'
import { Alert, btn } from '../components/ui'
import { IconKey } from '../components/icons'
import { RecoveryCodeBox } from '../components/RecoveryCodeBox'
import { recoveryCodeMemory } from '../lib/session-memory'

export function RecoveryCodePage() {
  const [code] = useState(() => recoveryCodeMemory.take())
  const [saved, setSaved] = useState(false)

  if (!code) {
    return (
      <Page>
        <Alert tone="info">Kein neuer Wiederherstellungscode vorhanden. Einen neuen kannst du im Profil erzeugen.</Alert>
        <Link to="/" className={btn('primary')}>Weiter zu deinen Anlässen</Link>
      </Page>
    )
  }

  return (
    <Page>
      <div className="flex flex-col gap-3 pt-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-pine-soft text-pine"><IconKey size={28} /></span>
        <h1 className="m-0 text-3xl font-bold">Dein Wiederherstellungscode</h1>
        <p className="m-0 text-[15px] text-ink-2">
          Mit diesem Code kannst du dein Passwort zurücksetzen, falls du es vergisst. Er wird <b>nur jetzt einmal</b> angezeigt.
          Speichere ihn z. B. in deinem Passwort-Manager.
        </p>
      </div>
      <RecoveryCodeBox code={code} />
      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input type="checkbox" className="size-5 accent-pine" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        Ich habe den Code sicher gespeichert.
      </label>
      {saved
        ? <Link to="/" className={btn('primary')}>Weiter zu deinen Anlässen</Link>
        : <span className={btn('primary', 'lg', 'opacity-60 cursor-not-allowed')} aria-disabled="true">Weiter zu deinen Anlässen</span>}
    </Page>
  )
}
