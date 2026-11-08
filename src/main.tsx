import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import '@fontsource-variable/inter'
import '@fontsource-variable/bricolage-grotesque'
import './index.css'
import { AuthProvider, useAuth } from './lib/auth'
import { queryClient } from './lib/queryClient'
import { router } from './router'
import { Loading } from './components/ui'
import { VersionBadge } from './components/VersionBadge'

// Clickjacking-Schutz: GitHub Pages erlaubt keinen frame-ancestors-Header.
if (window.top !== window.self) {
  document.documentElement.classList.add('framed')
  try {
    window.top!.location.href = window.self.location.href
  } catch {
    // Fremder Frame blockiert die Navigation – Inhalt bleibt verborgen.
  }
}

function App() {
  const auth = useAuth()
  useEffect(() => {
    if (auth.ready) void router.invalidate()
  }, [auth.ready, auth.session])
  if (!auth.ready) return <Loading />
  return (
    <>
      <RouterProvider router={router} context={{ auth }} />
      <VersionBadge signedIn={!!auth.session} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
