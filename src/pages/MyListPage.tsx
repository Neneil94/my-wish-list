import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { GroupGate, useGroupId, type GroupData } from '../components/GroupLayout'
import { Page } from '../components/AppShell'
import { WishThumb } from '../components/WishImage'
import { Alert, BackHeader, Button, Card, EmptyState, Pill, btn } from '../components/ui'
import { IconEdit, IconEyeOff, IconLink, IconPlus } from '../components/icons'
import { useGroups, useWishAction } from '../lib/api'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { formatCents } from '../lib/money'
import { urlHost } from '../lib/rules'
import type { Wish } from '../lib/types'
import { useQuery } from '@tanstack/react-query'

export function MyListPage() {
  const groupId = useGroupId()
  return <GroupGate groupId={groupId}>{(d) => <MyList d={d} />}</GroupGate>
}

function MyList({ d }: { d: GroupData }) {
  const [copyOpen, setCopyOpen] = useState(false)
  const mine = d.wishes.filter((w) => w.owner_id === d.userId)
  const g = d.group

  return (
    <Page>
      <BackHeader to="/groups/$groupId" params={{ groupId: g.id }} label="Zurück zum Anlass"
        title="Meine Wunschliste" subtitle={`${g.name} · ${mine.length} ${mine.length === 1 ? 'Wunsch' : 'Wünsche'}`} />
      <Alert tone="warn" icon={<IconEyeOff size={20} />}>
        <b>Überraschungsschutz aktiv.</b> Ob und von wem deine Wünsche beansprucht wurden, siehst du nicht – auch nicht als Admin.
      </Alert>
      {!d.me.is_recipient ? <Alert tone="info">In diesem Anlass bist du nicht als beschenkte Person eingetragen.</Alert> : null}

      {mine.length === 0 ? <EmptyState title="Noch keine Wünsche">Füge deinen ersten Wunsch hinzu – mit Link, Beschreibung und Preis.</EmptyState> : null}
      {mine.map((w) => (
        <Card key={w.id} className="flex items-start gap-3 py-3.5 pr-1.5 pl-3.5">
          <WishThumb path={w.image_path} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold">{w.title}</span>
              {w.priority === 'top' ? <Pill tone="pine">Top-Wunsch</Pill> : null}
            </div>
            {w.description ? <span className="truncate text-[13px] text-muted">{w.description}</span> : null}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{w.price_cents !== null ? formatCents(w.price_cents, true) : 'ohne Preis'}</span>
              {w.url ? <span className="inline-flex items-center gap-1 text-[13px] font-medium text-pine"><IconLink />{urlHost(w.url)}</span> : null}
            </div>
          </div>
          <Link to="/groups/$groupId/wishes/$wishId/edit" params={{ groupId: g.id, wishId: w.id }} aria-label={`„${w.title}“ bearbeiten`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-2 hover:bg-subtle"><IconEdit size={20} /></Link>
        </Card>
      ))}

      {d.me.is_recipient ? (
        <div className="flex flex-col gap-1 pt-2">
          <Link to="/groups/$groupId/wishes/new" params={{ groupId: g.id }} className={btn('primary')}><IconPlus size={20} />Wunsch hinzufügen</Link>
          <Button variant="ghost" size="md" onClick={() => setCopyOpen((v) => !v)} aria-expanded={copyOpen}>
            Aus einer anderen Liste übernehmen
          </Button>
          {copyOpen ? <CopyFromOtherList d={d} /> : null}
        </div>
      ) : null}
    </Page>
  )
}

function CopyFromOtherList({ d }: { d: GroupData }) {
  const groups = useGroups()
  const copy = useWishAction(d.group.id)
  const otherGroupIds = (groups.data ?? []).filter((g) => g.id !== d.group.id).map((g) => g.id)
  const other = useQuery({
    queryKey: ['my-other-wishes', d.group.id, otherGroupIds.join(',')],
    enabled: groups.isSuccess,
    queryFn: async () => {
      if (otherGroupIds.length === 0) return [] as Wish[]
      const { data, error } = await supabase.from('wishes').select('*').eq('owner_id', d.userId).in('group_id', otherGroupIds)
      if (error) throw error
      return data as Wish[]
    },
  })
  const existing = new Set(d.wishes.filter((w) => w.owner_id === d.userId).map((w) => w.title.toLowerCase()))
  const groupName = (id: string) => groups.data?.find((g) => g.id === id)?.name ?? ''

  if (other.isPending) return <p className="text-sm text-muted">Wird geladen …</p>
  if (!other.data?.length) return <p className="m-0 text-center text-sm text-muted">Du hast in anderen Anlässen noch keine Wünsche.</p>
  return (
    <Card className="mt-2 flex flex-col">
      {copy.error ? <Alert className="m-3">{errorMessage(copy.error)}</Alert> : null}
      {other.data.map((w) => {
        const done = existing.has(w.title.toLowerCase())
        return (
          <div key={w.id} className="flex items-center gap-3 border-line px-3.5 py-2.5 not-first:border-t">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{w.title}</span>
              <span className="text-xs text-muted">aus {groupName(w.group_id)}</span>
            </div>
            <Button size="sm" variant="secondary" disabled={done} onClick={() => copy.mutate({ type: 'copy', wish: w })}>
              {done ? 'Übernommen' : 'Übernehmen'}
            </Button>
          </div>
        )
      })}
    </Card>
  )
}
