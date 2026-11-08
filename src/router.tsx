import {
  Outlet, createHashHistory, type RouteComponent, createRootRouteWithContext, createRoute, createRouter, redirect,
} from '@tanstack/react-router'
import { AppShell } from './components/AppShell'
import type { AuthState } from './lib/auth'
import { gate } from './lib/session-memory'
import { supabase } from './lib/supabase'
import { GatePage } from './pages/GatePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPage } from './pages/ResetPage'
import { RecoveryCodePage } from './pages/RecoveryCodePage'
import { GroupsPage } from './pages/GroupsPage'
import { EditGroupPage, NewGroupPage } from './pages/GroupFormPage'
import { GroupDetailPage } from './pages/GroupDetailPage'
import { MembersPage } from './pages/MembersPage'
import { MyListPage } from './pages/MyListPage'
import { WishFormPage } from './pages/WishFormPage'
import { PersonListPage } from './pages/PersonListPage'
import { WishDetailPage } from './pages/WishDetailPage'
import { ContributePage } from './pages/ContributePage'
import { MyGiftsPage } from './pages/MyGiftsPage'
import { ProfilePage } from './pages/ProfilePage'
import { SecurityPage } from './pages/SecurityPage'
import { NotFoundPage } from './pages/NotFoundPage'

/** Liest die Session direkt (nicht aus React-State), damit Guards nach Login/Logout sofort stimmen. */
async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return data.session !== null
}

interface RouterContext {
  auth: AuthState
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
})

// ------------------------------------------------ Öffentlich (nicht eingeloggt)
const publicLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'public',
  beforeLoad: async () => {
    if (await hasSession()) throw redirect({ to: '/' })
  },
  component: Outlet,
})

const gateRoute = createRoute({ getParentRoute: () => publicLayout, path: '/gate', component: GatePage })

/** Login & Co. erst nach dem Zugangspasswort zeigen (UX; echte Prüfung serverseitig). */
const requireGate = () => {
  if (!gate.passed()) throw redirect({ to: '/gate' })
}
const loginRoute = createRoute({ getParentRoute: () => publicLayout, path: '/login', beforeLoad: requireGate, component: LoginPage })
const registerRoute = createRoute({ getParentRoute: () => publicLayout, path: '/register', beforeLoad: requireGate, component: RegisterPage })
const resetRoute = createRoute({ getParentRoute: () => publicLayout, path: '/reset', beforeLoad: requireGate, component: ResetPage })

// ------------------------------------------------ App (eingeloggt)
const appLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async () => {
    if (!(await hasSession())) throw redirect({ to: gate.passed() ? '/login' : '/gate' })
  },
  component: () => <AppShell><Outlet /></AppShell>,
})

const r = <TPath extends string>(path: TPath, component: RouteComponent) =>
  createRoute({ getParentRoute: () => appLayout, path, component })

const homeRoute = r('/', GroupsPage)
const recoveryCodeRoute = r('/recovery-code', RecoveryCodePage)
const newGroupRoute = r('/groups/new', NewGroupPage)
const groupRoute = r('/groups/$groupId', GroupDetailPage)
const editGroupRoute = r('/groups/$groupId/edit', EditGroupPage)
const membersRoute = r('/groups/$groupId/members', MembersPage)
const myListRoute = r('/groups/$groupId/my-list', MyListPage)
const newWishRoute = r('/groups/$groupId/wishes/new', WishFormPage)
const editWishRoute = r('/groups/$groupId/wishes/$wishId/edit', WishFormPage)
const wishRoute = r('/groups/$groupId/wishes/$wishId', WishDetailPage)
const claimRoute = r('/groups/$groupId/wishes/$wishId/claim', ContributePage)
const personRoute = r('/groups/$groupId/people/$userId', PersonListPage)
const giftsRoute = r('/gifts', MyGiftsPage)
const profileRoute = r('/profile', ProfilePage)
const securityRoute = r('/profile/security', SecurityPage)

const routeTree = rootRoute.addChildren([
  publicLayout.addChildren([gateRoute, loginRoute, registerRoute, resetRoute]),
  appLayout.addChildren([
    homeRoute, recoveryCodeRoute, newGroupRoute, groupRoute, editGroupRoute, membersRoute, myListRoute,
    newWishRoute, editWishRoute, wishRoute, claimRoute, personRoute, giftsRoute, profileRoute, securityRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: { auth: undefined! },
  defaultPreload: false,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
