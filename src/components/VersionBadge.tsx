import { useSyncExternalStore } from 'react'

const builtAt = new Date(__APP_BUILT_AT__)
const builtLabel = Number.isNaN(builtAt.getTime())
  ? ''
  : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(builtAt)

/** Seiten ohne untere Mobil-Navigation (öffentliche Seiten). */
const PUBLIC_PATHS = ['/gate', '/login', '/register', '/reset', '/legal']

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}
function currentPath(): string {
  return window.location.hash.replace(/^#/, '').split(/[?#]/)[0] || '/'
}

/**
 * Dezente Versionsanzeige unten rechts, einmal global eingebunden.
 * Klickt nichts weg (pointer-events-none); auf dem Handy über der unteren Navigation.
 */
export function VersionBadge({ signedIn }: { signedIn: boolean }) {
  const path = useSyncExternalStore(subscribe, currentPath)
  const aboveNav = signedIn && !PUBLIC_PATHS.includes(path)
  return (
    <p
      className={`pointer-events-none fixed right-2 z-10 m-0 select-none rounded bg-ground/80 px-1.5 py-0.5 font-mono text-[10px] leading-tight text-muted ${aboveNav ? 'bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-2' : 'bottom-2'}`}
      title={builtLabel ? `Build vom ${builtLabel}` : undefined}
    >
      <span className="sr-only">App-Version </span>v{__APP_VERSION__} · {__APP_COMMIT__}
    </p>
  )
}
