export interface Profile {
  id: string
  username: string
  display_name: string
}

export type GroupMode = 'all' | 'some'

export interface Group {
  id: string
  name: string
  occasion_date: string | null
  description: string | null
  mode: GroupMode
  created_at: string
}

export interface Member {
  group_id: string
  user_id: string
  role: 'admin' | 'member'
  status: 'invited' | 'active'
  is_recipient: boolean
  invited_by: string | null
  created_at: string
  profile: Profile | null
  inviter: Pick<Profile, 'username' | 'display_name'> | null
}

export interface GroupWithMembers extends Group {
  group_members: Member[]
}

export interface Wish {
  id: string
  group_id: string
  owner_id: string
  title: string
  description: string | null
  url: string | null
  price_cents: number | null
  priority: 'normal' | 'top'
  /** Pfad des großen Bildes im Bucket "wish-images"; die Vorschau liegt daneben (-thumb). */
  image_path: string | null
  created_at: string
  updated_at: string
}

export interface Claim {
  id: string
  wish_id: string
  user_id: string
  kind: 'full' | 'share'
  amount_cents: number | null
  note: string | null
  is_organizer: boolean
  purchased: boolean
  created_at: string
}

export interface Notice {
  id: string
  message: string
  created_at: string
}
