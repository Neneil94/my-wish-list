import { Link } from '@tanstack/react-router'
import { Page } from '../components/AppShell'
import { Alert, Avatar, Button, Card, EmptyState, Loading, Pill, SectionLabel, btn } from '../components/ui'
import { IconMail, IconPlus } from '../components/icons'
import { useGroupAction, useGroups, useMyProfile } from '../lib/api'
import { useAuth } from '../lib/auth'
import { daysUntil, formatOccasionDate, relativeDays } from '../lib/dates'
import { errorMessage } from '../lib/errors'
import type { GroupWithMembers } from '../lib/types'

export function GroupsPage() {
  const { userId } = useAuth()
  const profile = useMyProfile()
  const groups = useGroups()
  const action = useGroupAction()

  const all = groups.data ?? []
  const invites = all.filter((g) => g.group_members.find((m) => m.user_id === userId)?.status === 'invited')
  const active = all.filter((g) => g.group_members.find((m) => m.user_id === userId)?.status === 'active')
  const upcoming = active.filter((g) => (daysUntil(g.occasion_date) ?? 0) >= 0)
  const past = active.filter((g) => (daysUntil(g.occasion_date) ?? 0) < 0)

  return (
    <Page>
      <div className="flex items-center justify-between pt-5 md:pt-0">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-muted">Hallo {profile.data?.display_name ?? ''}</span>
          <h1 className="m-0 text-3xl font-bold">Deine Anlässe</h1>
        </div>
        <Link to="/groups/new" aria-label="Neuen Anlass erstellen" title="Neuen Anlass erstellen" className={btn('primary', 'md', 'w-11 px-0')}>
          <IconPlus />
        </Link>
      </div>

      {action.error ? <Alert>{errorMessage(action.error)}</Alert> : null}
      {groups.isPending ? <Loading /> : null}
      {groups.error ? <Alert>{errorMessage(groups.error)}</Alert> : null}

      {invites.map((g) => {
        const me = g.group_members.find((m) => m.user_id === userId)
        const inviter = me?.inviter
        return (
          <Card key={g.id} className="flex flex-col gap-3 border-pine-line bg-pine-soft p-4">
            <div className="flex items-start gap-2.5">
              <IconMail size={20} className="mt-0.5 shrink-0 text-pine-dark" />
              <p className="m-0 text-sm leading-snug">
                {inviter ? <><b>@{inviter.username}</b> lädt dich zu </> : <>Einladung zu </>}<b>{g.name}</b> ein.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="md" className="flex-1" loading={action.isPending && action.variables?.groupId === g.id}
                onClick={() => action.mutate({ type: 'respond', groupId: g.id, accept: true })}>Annehmen</Button>
              <Button size="md" variant="secondary" className="flex-1"
                onClick={() => action.mutate({ type: 'respond', groupId: g.id, accept: false })}>Ablehnen</Button>
            </div>
          </Card>
        )
      })}

      {groups.isSuccess && active.length === 0 && invites.length === 0 ? (
        <EmptyState title="Noch keine Anlässe">
          Erstelle einen Anlass wie „Weihnachten“ oder warte auf eine Einladung.
          <div className="mt-4"><Link to="/groups/new" className={btn('primary', 'md')}>Anlass erstellen</Link></div>
        </EmptyState>
      ) : null}

      <div className="flex flex-col gap-3">
        {upcoming.map((g) => <GroupCard key={g.id} group={g} userId={userId} />)}
      </div>

      {past.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="archive">
          <span id="archive"><SectionLabel>Archiv</SectionLabel></span>
          {past.map((g) => <GroupCard key={g.id} group={g} userId={userId} archived />)}
        </section>
      ) : null}
    </Page>
  )
}

function GroupCard({ group, userId, archived = false }: { group: GroupWithMembers; userId: string | null; archived?: boolean }) {
  const days = daysUntil(group.occasion_date)
  const active = group.group_members.filter((m) => m.status === 'active')
  const me = active.find((m) => m.user_id === userId)
  const recipients = active.filter((m) => m.is_recipient && m.user_id !== userId)
  return (
    <Link to="/groups/$groupId" params={{ groupId: group.id }}
      className={`flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-ink no-underline hover:border-line-2 ${archived ? 'opacity-80' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-xl font-bold">{group.name}</span>
          <span className="text-[13px] text-muted">{formatOccasionDate(group.occasion_date)}{archived ? ' · vergangen' : ''}</span>
        </div>
        {archived ? <Pill tone="muted">Archiv</Pill>
          : days !== null ? <Pill tone={days <= 50 ? 'apricot' : 'neutral'}>{relativeDays(days)}</Pill> : null}
      </div>
      {!archived ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex pl-2" aria-label={`${active.length} Mitglieder`}>
            {active.slice(0, 4).map((m) => (
              <Avatar key={m.user_id} name={m.profile?.display_name ?? '?'} seed={m.user_id} size={28} className="-ml-2 border-2 border-surface" />
            ))}
            {active.length > 4 ? (
              <span className="-ml-2 inline-flex size-7 items-center justify-center rounded-full border-2 border-surface bg-muted text-[11px] font-bold text-white">
                +{active.length - 4}
              </span>
            ) : null}
          </div>
          {group.mode === 'some' && !me?.is_recipient && recipients.length > 0
            ? <Pill tone="pine">Für {recipients.map((r) => r.profile?.display_name).join(', ')}</Pill>
            : <span className="text-[13px] text-muted">{active.length} Mitglieder</span>}
        </div>
      ) : null}
    </Link>
  )
}
