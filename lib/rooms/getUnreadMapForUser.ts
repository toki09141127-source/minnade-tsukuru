// lib/rooms/getUnreadMapForUser.ts
import { createAdminClient, createUserClient } from '@/lib/supabase/server'

/**
 * SSRで「自分の未読数 map(roomId -> count)」を作る
 * - room_members.last_seen_at を基準に posts.created_at を比較
 * - excludeSelf=true のとき、自分の投稿は未読カウントから除外
 */
export async function getUnreadMapForUser(opts?: { excludeSelf?: boolean }) {
  const excludeSelf = opts?.excludeSelf !== false // default true

  // SSRでログインユーザー取得（cookie）
  const supabaseUser = await createUserClient()
  const { data: userRes } = await supabaseUser.auth.getUser()
  const user = userRes?.user
  if (!user) return {} as Record<string, number>

  // Service Roleで集計（RLS回避して安全に集計）
  const admin = createAdminClient()

  // 1) 参加中ルーム（left_at=null）
  const { data: mems, error: memErr } = await admin
    .from('room_members')
    .select('room_id,last_seen_at,left_at')
    .eq('user_id', user.id)
    .is('left_at', null)

  if (memErr || !mems || mems.length === 0) {
    return {} as Record<string, number>
  }

  const roomIds = mems.map((m) => m.room_id)
  const lastSeenMap = new Map<string, string | null>()
  for (const m of mems) lastSeenMap.set(m.room_id, m.last_seen_at ?? null)

  // 2) クエリ最適化：minLastSeen より後だけ取る（N+1回避）
  const lastSeenValues = mems
    .map((m) => m.last_seen_at)
    .filter(Boolean) as string[]

  const minLastSeen = lastSeenValues.length
    ? new Date(Math.min(...lastSeenValues.map((v) => new Date(v).getTime()))).toISOString()
    : null

  let postsQuery = admin
    .from('posts')
    .select('room_id,created_at,user_id')
    .in('room_id', roomIds)
    .eq('is_hidden', false)
    .is('deleted_at', null)

  if (minLastSeen) postsQuery = postsQuery.gt('created_at', minLastSeen)
  if (excludeSelf) postsQuery = postsQuery.neq('user_id', user.id)

  const { data: posts, error: postsErr } = await postsQuery
  if (postsErr) {
    return {} as Record<string, number>
  }

  // 3) roomIdごとに未読カウント
  const map: Record<string, number> = {}
  for (const rid of roomIds) map[rid] = 0

  for (const p of posts ?? []) {
    const lastSeen = lastSeenMap.get(p.room_id) // string|null|undefined
    const lastSeenTime = lastSeen ? new Date(lastSeen).getTime() : 0
    const postTime = new Date(p.created_at).getTime()

    if (postTime > lastSeenTime) {
      map[p.room_id] = (map[p.room_id] ?? 0) + 1
    }
  }

  // 0件を消したいならここでフィルタしてもいいが、表示側で unread>0 だけ描くのでOK
  return map
}