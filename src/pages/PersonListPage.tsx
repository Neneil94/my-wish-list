import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { GroupDesktopLayout, GroupGate, useGroupId, type GroupData } from '../components/GroupLayout'
import { Alert, Avatar, BackHeader, EmptyState } from '../components/ui'
import { IconShield } from '../components/icons'
import { GiverWishCard } from '../components/WishCard'
import { summarize } from '../lib/wishStatus'

type Filter = 'all' | 'open' | 'done'

export function PersonListPage() {
  const groupId = useGroupId()
  const { userId } = useParams({ strict: false }) as { userId: string }
  return <GroupGate groupId={groupId}>{(d) => <PersonList d={d} personId={userId} />}</GroupGate>
}

function PersonList({ d, personId }: { d: GroupData; personId: string }) {
  const [filter, setFilter] = useState<Filter>('all')
  const person = d.active.find((m) => m.user_id === personId)

  if (personId === d.userId) {
    return <GroupDesktopLayout d={d}><div className="px-5 pt-6"><Alert tone="info">Das ist deine eigene Liste – öffne sie über „Meine Wunschliste“.</Alert></div></GroupDesktopLayout>
  }
  if (!person) {
    return <GroupDesktopLayout d={d}><div className="px-5 pt-6"><Alert>Diese Person ist kein Mitglied dieses Anlasses.</Alert></div></GroupDesktopLayout>
  }

  const name = person.profile?.display_name ?? 'Unbekannt'
  const wishes = d.wishes.filter((w) => w.owner_id === personId)
  const items = wishes.map((w) => ({ w, s: summarize(w, d.claims, d.userId) }))
  const shown = items.filter(({ s }) =>
    filter === 'all' ? true : filter === 'open' ? s.state !== 'covered' && !s.myClaim : s.state === 'covered' || !!s.myClaim)
  const nameOf = (uid: string) => d.active.find((m) => m.user_id === uid)?.profile?.display_name ?? null

  const filters: [Filter, string][] = [['all', 'Alle'], ['open', 'Offen'], ['done', 'Vergeben']]

  return (
    <GroupDesktopLayout d={d} selected={personId}>
      <div className="mx-auto flex max-w-xl flex-col gap-3.5 px-5 pt-3 md:mx-0 md:max-w-none md:px-0 md:pt-0">
        <div className="md:hidden">
          <BackHeader to="/groups/$groupId" params={{ groupId: d.group.id }} label="Zurück zum Anlass"
            title={`${possessive(name)} Wunschliste`} subtitle={`${d.group.name} · ${wishes.length} Wünsche`} />
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Avatar name={name} seed={personId} size={44} />
          <h1 className="m-0 text-3xl font-bold">{possessive(name)} Wunschliste</h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-pine-soft px-3 py-2.5 text-[13px] font-medium text-pine-dark">
          <IconShield size={18} className="shrink-0" /> {name} sieht nicht, was beansprucht wurde.
        </div>
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-2">
          {filters.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
              className={`h-9 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold ${filter === id ? 'border border-ink bg-ink text-white' : 'border border-line-2 bg-surface text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        {wishes.length === 0 ? <EmptyState title="Noch keine Wünsche">{name} hat noch nichts auf die Liste gesetzt.</EmptyState> : null}
        <div className="flex flex-col gap-3 md:grid md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:gap-4">
          {shown.map(({ w, s }) => (
            <GiverWishCard key={w.id} wish={w} s={s} groupId={d.group.id}
              claimerName={s.fullClaim ? nameOf(s.fullClaim.user_id) : null} />
          ))}
        </div>
      </div>
    </GroupDesktopLayout>
  )
}

function possessive(name: string): string {
  return /[sßxz]$/i.test(name) ? `${name}’` : `${name}s`
}
