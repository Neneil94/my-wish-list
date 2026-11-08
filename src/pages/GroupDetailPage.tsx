import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { GroupDesktopLayout, GroupGate, PeopleList, useGroupId, type GroupData } from '../components/GroupLayout'
import { Alert, Button, ConfirmDialog, SectionLabel } from '../components/ui'
import { IconChevronLeft, IconChevronRight, IconEdit, IconList, IconUsers } from '../components/icons'
import { useGroupAction } from '../lib/api'
import { daysUntil, formatOccasionDate, relativeDays } from '../lib/dates'
import { errorMessage } from '../lib/errors'

export function GroupDetailPage() {
  const groupId = useGroupId()
  return <GroupGate groupId={groupId}>{(d) => <GroupDetail d={d} />}</GroupGate>
}

function GroupDetail({ d }: { d: GroupData }) {
  const navigate = useNavigate()
  const action = useGroupAction()
  const [confirmLeave, setConfirmLeave] = useState(false)
  const g = d.group
  const days = daysUntil(g.occasion_date)
  const myCount = d.wishes.filter((w) => w.owner_id === d.userId).length

  async function leave() {
    try {
      await action.mutateAsync({ type: 'leave', groupId: g.id })
      await navigate({ to: '/' })
    } catch {
      // Fehler im Dialog
    }
  }

  return (
    <GroupDesktopLayout d={d}>
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-3 md:mx-0 md:max-w-none md:px-0 md:pt-0">
        <div className="-mx-2.5 flex items-center justify-between">
          <Link to="/" aria-label="Zurück zu Anlässen" className="inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-subtle">
            <IconChevronLeft />
          </Link>
          <div className="flex">
            <Link to="/groups/$groupId/members" params={{ groupId: g.id }} aria-label="Mitglieder" title="Mitglieder"
              className="inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-subtle"><IconUsers /></Link>
            {d.isAdmin ? (
              <Link to="/groups/$groupId/edit" params={{ groupId: g.id }} aria-label="Anlass bearbeiten" title="Anlass bearbeiten"
                className="inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-subtle"><IconEdit /></Link>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-3xl leading-tight font-bold md:text-4xl">{g.name}</h1>
          <p className="m-0 text-[13px] text-muted md:text-[15px]">
            {formatOccasionDate(g.occasion_date)}{days !== null && days >= 0 ? ` · ${relativeDays(days)}` : ''} · {d.active.length} Mitglieder
          </p>
          {g.description ? <p className="m-0 text-[13px] whitespace-pre-line text-ink-2 md:text-[15px]">{g.description}</p> : null}
        </div>

        {d.me.is_recipient ? (
          <Link to="/groups/$groupId/my-list" params={{ groupId: g.id }}
            className="flex items-center gap-3.5 rounded-2xl bg-pine p-4 text-white no-underline hover:bg-pine-dark">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><IconList /></span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-base font-semibold">Meine Wunschliste</span>
              <span className="text-[13px] text-[#D4E6DD]">{myCount} {myCount === 1 ? 'Wunsch' : 'Wünsche'} · Überraschungen bleiben geheim</span>
            </span>
            <IconChevronRight />
          </Link>
        ) : (
          <Alert tone="info">In diesem Anlass hast du keine eigene Wunschliste – du schenkst nur.</Alert>
        )}

        <div className="flex flex-col gap-3 md:hidden">
          <SectionLabel>Listen der anderen</SectionLabel>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface"><PeopleList d={d} /></div>
        </div>
        <p className="m-0 hidden rounded-2xl border border-dashed border-line-2 p-6 text-center text-sm text-muted md:block">
          Wähle links eine Person, um ihre Wunschliste zu sehen.
        </p>

        <Button variant="danger-ghost" size="md" className="mt-4 self-center" onClick={() => setConfirmLeave(true)}>
          Anlass verlassen
        </Button>
      </div>
      <ConfirmDialog open={confirmLeave} title="Anlass verlassen?" confirmLabel="Verlassen" loading={action.isPending}
        onClose={() => setConfirmLeave(false)} onConfirm={leave}>
        Deine Wunschliste und deine Zusagen in „{g.name}“ werden entfernt.
        {action.error ? <Alert className="mt-3">{errorMessage(action.error)}</Alert> : null}
      </ConfirmDialog>
    </GroupDesktopLayout>
  )
}
