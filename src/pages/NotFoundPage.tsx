import { Link } from '@tanstack/react-router'
import { PublicPage } from '../components/AppShell'

export function NotFoundPage() {
  return (
    <PublicPage>
      <h1 className="m-0 text-3xl font-bold">Seite nicht gefunden</h1>
      <Link to="/">Zur Startseite</Link>
    </PublicPage>
  )
}
