import { useState } from 'react'
import { Button } from './ui'

export function RecoveryCodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <p className="m-0 text-center font-mono text-xl font-semibold tracking-wider select-all" aria-label="Wiederherstellungscode">
        {code}
      </p>
      <Button variant="secondary" size="md" onClick={copy}>{copied ? 'Kopiert' : 'Code kopieren'}</Button>
    </div>
  )
}
