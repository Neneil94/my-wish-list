import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Claim, GroupMode, GroupWithMembers, Notice, Profile, Wish } from './types'

const MEMBER_SELECT =
  'group_id,user_id,role,status,is_recipient,invited_by,created_at,' +
  'profile:profiles!group_members_user_id_fkey(id,username,display_name),' +
  'inviter:profiles!group_members_invited_by_fkey(username,display_name)'

const GROUP_SELECT = `id,name,occasion_date,description,mode,created_at,group_members(${MEMBER_SELECT})`

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

async function rpc<T = void>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

export const keys = {
  profile: (id: string) => ['profile', id] as const,
  groups: ['groups'] as const,
  group: (id: string) => ['group', id] as const,
  wishes: (gid: string) => ['wishes', gid] as const,
  claims: (gid: string) => ['claims', gid] as const,
  myGifts: ['my-gifts'] as const,
  notices: ['notices'] as const,
}

// ---------------------------------------------------------------- Queries

export function useMyProfile() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: keys.profile(userId ?? ''),
    enabled: !!userId,
    queryFn: async () =>
      unwrap<Profile>(await supabase.from('profiles').select('id,username,display_name').eq('id', userId!).single()),
  })
}

export function useGroups() {
  return useQuery({
    queryKey: keys.groups,
    queryFn: async () =>
      unwrap<GroupWithMembers[]>(
        await supabase.from('groups').select(GROUP_SELECT).order('occasion_date', { ascending: true, nullsFirst: false }),
      ),
  })
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: keys.group(groupId),
    queryFn: async () =>
      unwrap<GroupWithMembers>(await supabase.from('groups').select(GROUP_SELECT).eq('id', groupId).single()),
  })
}

export function useWishes(groupId: string, enabled = true) {
  return useQuery({
    queryKey: keys.wishes(groupId),
    enabled,
    queryFn: async () =>
      unwrap<Wish[]>(
        await supabase.from('wishes').select('*').eq('group_id', groupId)
          .order('priority', { ascending: false }).order('created_at', { ascending: true }),
      ),
  })
}

/** Claims im Anlass. RLS liefert dabei NIE Claims auf eigene Wünsche. */
export function useClaims(groupId: string, enabled = true) {
  return useQuery({
    queryKey: keys.claims(groupId),
    enabled,
    queryFn: async () =>
      unwrap<Claim[]>(
        await supabase.from('claims').select('*, wishes!inner(group_id)').eq('wishes.group_id', groupId),
      ),
  })
}

export interface MyGift {
  claim: Claim
  wish: Wish & { group: { id: string; name: string; occasion_date: string | null } | null }
  coveredCents: number
  contributors: number
  ownerName: string
}

export function useMyGifts() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: keys.myGifts,
    enabled: !!userId,
    queryFn: async (): Promise<MyGift[]> => {
      const mine = unwrap<(Claim & { wish: MyGift['wish'] })[]>(
        await supabase.from('claims')
          .select('*, wish:wishes(*, group:groups(id,name,occasion_date))')
          .eq('user_id', userId!),
      )
      const wishIds = mine.map((c) => c.wish_id)
      if (wishIds.length === 0) return []
      const all = unwrap<Claim[]>(await supabase.from('claims').select('*').in('wish_id', wishIds))
      const ownerIds = [...new Set(mine.map((c) => c.wish.owner_id))]
      const owners = unwrap<Profile[]>(
        await supabase.from('profiles').select('id,username,display_name').in('id', ownerIds),
      )
      return mine.map((c) => {
        const related = all.filter((a) => a.wish_id === c.wish_id)
        return {
          claim: c,
          wish: c.wish,
          coveredCents: related.reduce((s, a) => s + (a.amount_cents ?? 0), 0),
          contributors: related.length,
          ownerName: owners.find((o) => o.id === c.wish.owner_id)?.display_name ?? 'Unbekannt',
        }
      })
    },
  })
}

export function useNotices() {
  return useQuery({
    queryKey: keys.notices,
    queryFn: async () =>
      unwrap<Notice[]>(await supabase.from('notices').select('id,message,created_at').order('created_at', { ascending: false })),
  })
}

export async function findUserByUsername(username: string): Promise<Profile | null> {
  const rows = await rpc<Profile[]>('find_user_by_username', { p_username: username })
  return rows?.[0] ?? null
}

// ---------------------------------------------------------------- Mutations

function useInvalidate() {
  const qc = useQueryClient()
  return (...k: (readonly unknown[])[]) => Promise.all(k.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

export interface GroupInput {
  name: string
  occasionDate: string
  description: string
  mode: GroupMode
}

export function useSaveGroup() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ groupId, input }: { groupId?: string; input: GroupInput }) => {
      const args = {
        p_name: input.name,
        p_occasion_date: input.occasionDate || null,
        p_description: input.description,
        p_mode: input.mode,
      }
      if (groupId) {
        await rpc('update_group', { p_group_id: groupId, ...args })
        return groupId
      }
      return rpc<string>('create_group', args)
    },
    onSuccess: (gid) => invalidate(keys.groups, keys.group(gid)),
  })
}

export function useGroupAction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (a:
      | { type: 'delete'; groupId: string }
      | { type: 'leave'; groupId: string }
      | { type: 'respond'; groupId: string; accept: boolean }
      | { type: 'invite'; groupId: string; username: string }
      | { type: 'remove'; groupId: string; userId: string }
      | { type: 'role'; groupId: string; userId: string; role: 'admin' | 'member' }
      | { type: 'recipient'; groupId: string; userId: string; isRecipient: boolean }) => {
      switch (a.type) {
        case 'delete': return rpc('delete_group', { p_group_id: a.groupId })
        case 'leave': return rpc('leave_group', { p_group_id: a.groupId })
        case 'respond': return rpc('respond_invite', { p_group_id: a.groupId, p_accept: a.accept })
        case 'invite': return rpc('invite_member', { p_group_id: a.groupId, p_username: a.username })
        case 'remove': return rpc('remove_member', { p_group_id: a.groupId, p_user_id: a.userId })
        case 'role': return rpc('set_member_role', { p_group_id: a.groupId, p_user_id: a.userId, p_role: a.role })
        case 'recipient':
          return rpc('set_member_recipient', { p_group_id: a.groupId, p_user_id: a.userId, p_is_recipient: a.isRecipient })
      }
    },
    onSuccess: (_d, a) => invalidate(keys.groups, keys.group(a.groupId), keys.wishes(a.groupId), keys.claims(a.groupId)),
  })
}

export interface WishInput {
  title: string
  description: string
  url: string | null
  priceCents: number | null
  priority: 'normal' | 'top'
}

export function useSaveWish(groupId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ wishId, input }: { wishId?: string; input: WishInput }) =>
      rpc<string>('upsert_wish', {
        p_wish_id: wishId ?? null,
        p_group_id: groupId,
        p_title: input.title,
        p_description: input.description,
        p_url: input.url,
        p_price_cents: input.priceCents,
        p_priority: input.priority,
      }),
    onSuccess: () => invalidate(keys.wishes(groupId), keys.groups),
  })
}

export function useWishAction(groupId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (a: { type: 'delete'; wishId: string } | { type: 'copy'; wishId: string }) =>
      a.type === 'delete'
        ? rpc('delete_wish', { p_wish_id: a.wishId })
        : rpc('copy_wish', { p_wish_id: a.wishId, p_target_group_id: groupId }),
    onSuccess: () => invalidate(keys.wishes(groupId), keys.groups),
  })
}

export function useClaimAction(groupId?: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (a:
      | { type: 'claim'; wishId: string; kind: 'full' | 'share'; amountCents: number | null; note: string; isOrganizer: boolean }
      | { type: 'unclaim'; wishId: string }
      | { type: 'purchased'; wishId: string; purchased: boolean }) => {
      switch (a.type) {
        case 'claim':
          return rpc('claim_wish', {
            p_wish_id: a.wishId, p_kind: a.kind, p_amount_cents: a.amountCents,
            p_note: a.note, p_is_organizer: a.isOrganizer,
          })
        case 'unclaim': return rpc('unclaim_wish', { p_wish_id: a.wishId })
        case 'purchased': return rpc('set_claim_purchased', { p_wish_id: a.wishId, p_purchased: a.purchased })
      }
    },
    onSuccess: () => invalidate(keys.myGifts, ...(groupId ? [keys.claims(groupId)] : [['claims']])),
  })
}

export function useDismissNotice() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => rpc('dismiss_notice', { p_notice_id: id }),
    onSuccess: () => invalidate(keys.notices),
  })
}

export function useUpdateDisplayName() {
  const invalidate = useInvalidate()
  const { userId } = useAuth()
  return useMutation({
    mutationFn: (name: string) => rpc('update_display_name', { p_display_name: name }),
    onSuccess: () => invalidate(keys.profile(userId ?? ''), keys.groups),
  })
}

export async function deleteMyAccount(): Promise<void> {
  await rpc('delete_my_account', {})
}
