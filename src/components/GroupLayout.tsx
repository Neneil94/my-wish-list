import type { ReactNode } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { Alert, Avatar, Loading, ProgressBar, SectionLabel } from './ui'
import { IconChevronRight } from './icons'
import { useClaims, useGroup, useWishes } from '../lib/api'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/errors'
import { summarize } from '../lib/wishStatus'
import type { Claim, GroupWithMembers, Member, Wish } from '../lib/types'

export interface GroupData {
  group: GroupWithMembers
  me: Member
  isAdmin: boolean
  active: Member[]
  others: Member[]
  wishes: Wish[]
  claims: Claim[]
  userId: string
}

/** Lädt Anlass, Wünsche und (für mich sichtbare) Claims. */
export function useGroupData(groupId: string) {
  const { userId } = useAuth()
  const group = useGroup(groupId)
  const me = group.data?.group_members.find((m) => m.user_id === userId)
  const isActive = me?.status === 'active'
  const wishes = useWishes(groupId, isActive)
  const claims = useClaims(groupId, isActive)

  const loading = group.isPending || (isActive && (wishes.isPending || claims.isPending))
  const error = group.error ?? wishes.error ?? claims.error
  let data: GroupData | null = null
  if (group.data && me && userId && wishes.data && claims.data) {
    const active = group.data.group_members.filter((m) => m.status === 'active')
    data = {
      group: group.data, me, userId, isAdmin: me.role === 'admin' && isActive,
      active, others: active.filter((m) => m.user_id !== userId && m.is_recipient),
      wishes: wishes.data, claims: claims.data,
    }
  }
  return { loading, error, data, invited: me?.status === 'invited' }
}

export function GroupGate({ groupId, children }: { groupId: string; children: (d: GroupData) => ReactNode }) {
  const { loading, error, data, invited } = useGroupData(groupId)
  if (loading) return <div className="mx-auto max-w-xl px-5"><Loading /></div>
  if (error || invited || !data) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-8">
        <Alert>{invited ? 'Nimm zuerst die Einladung auf der Startseite an.' : error ? errorMessage(error) : 'Diesen Anlass gibt es nicht oder du bist kein Mitglied.'}</Alert>
        <Link to="/">Zu deinen Anlässen</Link>
      </div>
    )
  }
  return <>{children(data)}</>
}

export function personStats(d: GroupData, userId: string) {
  const ws = d.wishes.filter((w) => w.owner_id === userId)
  const covered = ws.filter((w) => summarize(w, d.claims, d.userId).state !== 'open').length
  return { count: ws.length, covered }
}

export function PeopleList({ d, selected }: { d: GroupData; selected?: string }) {
  if (d.others.length === 0) {
    return <p className="m-0 px-3.5 py-3 text-sm text-muted">Noch keine anderen Personen mit Wunschliste. Lade Mitglieder ein.</p>
  }
  return (
    <ul className="m-0 list-none p-0">
      {d.others.map((m) => {
        const { count, covered } = personStats(d, m.user_id)
        const name = m.profile?.display_name ?? 'Unbekannt'
        const on = selected === m.user_id
        return (
          <li key={m.user_id} className="border-line not-first:border-t">
            <Link to="/groups/$groupId/people/$userId" params={{ groupId: d.group.id, userId: m.user_id }}
              aria-current={on ? 'page' : undefined}
              className={`flex items-center gap-3 px-3.5 py-3 text-ink no-underline hover:bg-ground ${on ? 'bg-ground outline-2 -outline-offset-2 outline-pine' : ''}`}>
              <Avatar name={name} seed={m.user_id} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-[15px] font-semibold">{name}</span>
                  <span className="text-[13px] text-muted">
                    {count === 0 ? 'Noch keine Wünsche' : `${count} ${count === 1 ? 'Wunsch' : 'Wünsche'} · ${covered} vergeben`}
                  </span>
                </div>
                <ProgressBar value={count ? covered / count : 0} height={6} />
              </div>
              <IconChevronRight className="text-muted" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Auf großen Screens: links die Personen, rechts der Inhalt. Mobil nur der Inhalt. */
export function GroupDesktopLayout({ d, children, selected }: { d: GroupData; children: ReactNode; selected?: string }) {
  return (
    <div className="mx-auto w-full max-w-6xl md:grid md:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] md:gap-6 md:px-8 md:pt-8">
      <aside className="hidden md:block" aria-label="Listen der anderen">
        <div className="sticky top-6 flex flex-col gap-3">
          <Link to="/groups/$groupId" params={{ groupId: d.group.id }} className="font-display text-xl font-bold text-ink no-underline">
            {d.group.name}
          </Link>
          <SectionLabel>Listen der anderen</SectionLabel>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface"><PeopleList d={d} selected={selected} /></div>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function useGroupId(): string {
  return (useParams({ strict: false }) as { groupId: string }).groupId
}
