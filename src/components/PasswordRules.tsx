import { checkPassword, passwordStrength } from '../lib/rules'
import { IconCheck } from './icons'

const LABELS = ['Zu schwach', 'Schwach', 'Mittel', 'Gut', 'Stark']
const COLORS = ['#B42318', '#E07B39', '#C9A227', '#1F5F4A']

export function PasswordRules({ password, username }: { password: string; username: string }) {
  const c = checkPassword(password, username)
  const score = passwordStrength(password, username)
  const items: [string, boolean][] = [
    ['Mindestens 12 Zeichen', c.length],
    ['Enthält nicht den Username', c.notUsername],
    ['Buchstaben und Zahlen/Sonderzeichen', c.mixed],
  ]
  const color = score === 0 ? '#E4E2DC' : COLORS[score - 1]
  return (
    <div className="flex flex-col gap-2" id="pw-rules">
      <div className="grid grid-cols-4 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-1 rounded-sm" style={{ background: i < score ? color : '#E4E2DC' }} />
        ))}
      </div>
      <span className={`text-xs font-semibold ${score >= 4 ? 'text-pine' : score >= 2 ? 'text-[#8A5A00]' : 'text-danger'}`}>
        Stärke: {LABELS[score]}
      </span>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Passwortregeln">
        {items.map(([label, ok]) => (
          <li key={label} className="flex items-center gap-2 text-[13px] text-ink-2">
            <span className={`flex size-4.5 items-center justify-center rounded-full ${ok ? 'bg-pine text-white' : 'bg-line text-line'}`}>
              <IconCheck size={12} />
            </span>
            {label}<span className="sr-only">{ok ? ' – erfüllt' : ' – nicht erfüllt'}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-[13px] text-muted">
          <span className="size-4.5" aria-hidden />Wird beim Absenden gegen bekannte Datenlecks geprüft
        </li>
      </ul>
    </div>
  )
}
