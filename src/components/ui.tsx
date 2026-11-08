import {
  useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes,
} from 'react'
import { Link } from '@tanstack/react-router'
import { IconAlert, IconChevronLeft, IconEye, IconEyeOff } from './icons'

// ------------------------------------------------------------------ Buttons

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger' | 'danger-outline' | 'danger-ghost'
type Size = 'md' | 'lg' | 'sm'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-pine text-white hover:bg-pine-dark',
  secondary: 'bg-surface text-ink border border-line-2 hover:bg-[#FBFAF7]',
  ghost: 'bg-transparent text-pine hover:bg-pine-soft',
  accent: 'bg-apricot text-ink hover:bg-apricot-dark',
  danger: 'bg-danger text-white hover:bg-danger-ink',
  'danger-outline': 'bg-transparent text-danger border border-danger-line hover:bg-danger-soft',
  'danger-ghost': 'bg-transparent text-danger hover:bg-danger-soft',
}
const SIZES: Record<Size, string> = {
  lg: 'h-13 px-5 text-base',
  md: 'h-11 px-4 text-[15px]',
  sm: 'h-9 px-3.5 text-[13px]',
}

export function btn(variant: Variant = 'primary', size: Size = 'lg', extra = ''): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold no-underline',
    'transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer select-none',
    VARIANTS[variant], SIZES[size], extra,
  ].join(' ')
}

export function Button({
  variant = 'primary', size = 'lg', className = '', loading = false, children, disabled, type = 'button', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button type={type} className={btn(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

export function IconButton({ label, children, className = '', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-subtle cursor-pointer ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
}

// ------------------------------------------------------------------ Form

export function Field({ label, hint, error, children, optional, htmlFor }: {
  label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; optional?: boolean; htmlFor: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}{optional ? <span className="font-normal text-muted"> (optional)</span> : null}
      </label>
      {children}
      {error ? <p id={`${htmlFor}-error`} className="text-[13px] text-danger" role="alert">{error}</p>
        : hint ? <p id={`${htmlFor}-hint`} className="text-[13px] leading-snug text-muted">{hint}</p> : null}
    </div>
  )
}

const inputBase =
  'w-full rounded-xl border bg-surface px-3.5 text-base text-ink placeholder:text-[#8A8D94] ' +
  'focus:outline-none focus-visible:outline-[3px] focus-visible:outline-pine focus-visible:outline-offset-0 ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:border-2'

export function Input({ className = '', invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={`${inputBase} h-12 border-line-2 ${className}`}
      aria-invalid={invalid || undefined}
      aria-describedby={rest.id ? `${rest.id}-${invalid ? 'error' : 'hint'}` : undefined}
      {...rest}
    />
  )
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputBase} min-h-22 resize-y border-line-2 py-3 leading-snug ${className}`} {...rest} />
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-13" autoCapitalize="none" spellCheck={false} />
      <button type="button" onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'} aria-pressed={visible}
        className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-muted hover:bg-subtle cursor-pointer">
        {visible ? <IconEyeOff size={20} /> : <IconEye size={20} />}
      </button>
    </div>
  )
}

// ------------------------------------------------------------------ Feedback

type Tone = 'error' | 'warn' | 'info' | 'success'
const TONES: Record<Tone, string> = {
  error: 'bg-danger-soft border-danger-line text-danger-ink',
  warn: 'bg-apricot-soft border-apricot-line text-apricot-deep',
  info: 'bg-pine-soft border-pine-line text-pine-dark',
  success: 'bg-pine-soft border-pine-line text-pine-dark',
}

export function Alert({ tone = 'error', icon, children, className = '' }: {
  tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-snug ${TONES[tone]} ${className}`}>
      <span className="mt-px shrink-0">{icon ?? <IconAlert size={18} />}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Loading({ label = 'Wird geladen …' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted" role="status">
      <Spinner /> <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-2 px-6 py-10 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {children ? <div className="text-sm text-muted">{children}</div> : null}
    </div>
  )
}

// ------------------------------------------------------------------ Display

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>
}

type PillTone = 'pine' | 'apricot' | 'neutral' | 'muted'
const PILL: Record<PillTone, string> = {
  pine: 'bg-pine-soft text-pine-dark',
  apricot: 'bg-apricot-soft text-apricot-ink',
  neutral: 'bg-subtle text-ink-2',
  muted: 'bg-subtle text-muted',
}
export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${PILL[tone]}`}>{children}</span>
}

const AVATAR_COLORS = ['#1F5F4A', '#8A3E0B', '#3D4F8A', '#6B4E8A', '#5B5E66', '#7A4A2A', '#2F5E7A']
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0] ?? '?'
  if (parts.length > 1) return (first[0]! + parts[parts.length - 1]![0]!).toUpperCase()
  return first.slice(0, 2).toUpperCase()
}
function colorFor(seed: string): string {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!
}
export function Avatar({ name, seed, size = 40, className = '' }: { name: string; seed: string; size?: number; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.33), background: colorFor(seed) }}>
      {initials(name)}
    </span>
  )
}

export function ProgressBar({ value, label, height = 8 }: { value: number; label?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div className="w-full overflow-hidden rounded-full bg-subtle" style={{ height }}
      role={label ? 'progressbar' : undefined} aria-label={label} aria-valuenow={label ? pct : undefined}
      aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? 100 : undefined} aria-hidden={label ? undefined : true}>
      <div className="h-full rounded-full bg-apricot" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="m-0 font-sans text-xs font-semibold uppercase tracking-[0.06em] text-muted">{children}</h2>
}

// ------------------------------------------------------------------ Layout bits

export function BackHeader({ to, params, label, title, subtitle, actions }: {
  to: string; params?: Record<string, string>; label: string; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode
}) {
  return (
    <div className="-ml-2.5 flex items-center gap-1">
      <Link to={to} params={params} aria-label={label}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-subtle">
        <IconChevronLeft />
      </Link>
      {title ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="m-0 truncate text-2xl font-bold">{title}</h1>
          {subtitle ? <span className="truncate text-[13px] text-muted">{subtitle}</span> : null}
        </div>
      ) : <div className="flex-1" />}
      {actions}
    </div>
  )
}

// ------------------------------------------------------------------ Dialog

export function ConfirmDialog({ open, title, children, confirmLabel, tone = 'danger', onConfirm, onClose, loading }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; tone?: 'danger' | 'primary'
  onConfirm: () => void; onClose: () => void; loading?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} onCancel={onClose}
      className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/40">
      <div className="flex flex-col gap-4 p-5">
        <h2 id={titleId} className="m-0 text-xl font-bold">{title}</h2>
        <div className="text-[15px] leading-relaxed text-ink-2">{children}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" onClick={onClose}>Abbrechen</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} size="md" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
