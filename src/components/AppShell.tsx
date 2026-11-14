import { useEffect, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { IconCalendar, IconGift, IconUser } from './icons'
import { Avatar } from './ui'
import { cleanupWishImages, useMyProfile } from '../lib/api'

const NAV = [
  { to: '/', label: 'Anlässe', Icon: IconCalendar, match: (p: string) => p === '/' || p.startsWith('/groups') },
  { to: '/gifts', label: 'Meine Geschenke', Icon: IconGift, match: (p: string) => p.startsWith('/gifts') },
  { to: '/profile', label: 'Profil', Icon: IconUser, match: (p: string) => p.startsWith('/profile') },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const profile = useMyProfile()

  // Einmal pro Browser-Sitzung verwaiste Wunschbilder aufräumen lassen (z. B. nach
  // gelöschten Konten oder Anlässen, bei denen niemand mehr eingeloggt war).
  useEffect(() => {
    try {
      if (sessionStorage.getItem('mwl-image-cleanup')) return
      sessionStorage.setItem('mwl-image-cleanup', '1')
    } catch { /* ohne sessionStorage: trotzdem aufräumen */ }
    cleanupWishImages()
  }, [])

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Zum Inhalt springen
      </a>

      {/* Desktop/Tablet: Kopfleiste */}
      <header className="hidden border-b border-line bg-surface md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-8 py-3">
          <Link to="/" className="flex items-center gap-2.5 text-ink no-underline">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-pine text-white"><IconGift size={18} /></span>
            <span className="font-display text-[19px] font-bold">my-wish-list</span>
          </Link>
          <nav aria-label="Hauptnavigation" className="flex flex-1 gap-1">
            {NAV.slice(0, 2).map(({ to, label, match }) => (
              <Link key={to} to={to} aria-current={match(path) ? 'page' : undefined}
                className={`flex h-11 items-center rounded-[10px] px-3.5 text-sm font-semibold no-underline ${match(path) ? 'bg-pine-soft text-pine-dark' : 'text-ink-2 hover:bg-subtle'}`}>
                {label}
              </Link>
            ))}
          </nav>
          <Link to="/profile" aria-current={path.startsWith('/profile') ? 'page' : undefined}
            className="flex h-11 items-center gap-2 rounded-[10px] px-2.5 text-sm font-semibold text-ink-2 no-underline hover:bg-subtle">
            {profile.data ? <Avatar name={profile.data.display_name} seed={profile.data.id} size={30} /> : null}
            {profile.data?.display_name ?? 'Profil'}
          </Link>
        </div>
      </header>

      <main id="main" className="flex-1 pb-24 md:pb-10">{children}</main>

      {/* Mobil: untere Navigation */}
      <nav aria-label="Hauptnavigation" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden">
        {NAV.map(({ to, label, Icon, match }) => (
          <Link key={to} to={to} aria-current={match(path) ? 'page' : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold no-underline ${match(path) ? 'text-pine' : 'text-muted'}`}>
            <Icon size={24} />{label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

/** Schmale Spalte für Handy-orientierte Seiten, zentriert auf großen Screens. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto flex w-full flex-col gap-4 px-5 pt-3 md:pt-8 ${wide ? 'max-w-6xl md:px-8' : 'max-w-xl'}`}>
      {children}
    </div>
  )
}

export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-6 pt-14 pb-8 md:pt-24">
      {children}
      <LegalLink className="mt-auto pt-2" />
    </main>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-pine text-white"><IconGift size={20} /></span>
      <span className="font-display text-xl font-bold">my-wish-list</span>
    </div>
  )
}

/** Kleiner Footer-Link für öffentliche Seiten und das Profil. */
export function LegalLink({ className = '' }: { className?: string }) {
  return (
    <p className={`m-0 text-center text-[13px] text-muted ${className}`}>
      <Link to="/legal" className="text-muted">Hinweise &amp; Datenschutz</Link>
    </p>
  )
}
