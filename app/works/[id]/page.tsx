// app/works/[id]/page.tsx
import Link from 'next/link'
import { supabase } from '../../../lib/supabase/client'

type RoomRow = {
  id: string
  title: string
  work_type: string
  status: string
  created_at: string
  like_count: number | null
  is_hidden: boolean
  deleted_at?: string | null
}

type PostRow = {
  id: string
  user_id: string
  username: string | null
  content: string
  created_at: string
  is_hidden: boolean
}

export const dynamic = 'force-dynamic'

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const p = await Promise.resolve(params)
  const roomId = p?.id

  if (!roomId) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#b00020' }}>roomId が取得できませんでした。</p>
        <Link href="/works">← 一覧へ</Link>
      </div>
    )
  }

  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id, title, work_type, status, created_at, like_count, is_hidden, deleted_at')
    .eq('id', roomId)
    .maybeSingle<RoomRow>()

  if (roomErr || !room || room.deleted_at || room.is_hidden) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#b00020' }}>作品が見つかりませんでした。</p>
        <Link href="/works">← 一覧へ</Link>
      </div>
    )
  }

  if (room.status !== 'forced_publish') {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#b00020' }}>このルームはまだ公開されていません。</p>
        <Link href={`/rooms/${room.id}`}>← ルームへ</Link>
      </div>
    )
  }

  const { data: posts, error: postsErr } = await supabase
    .from('posts')
    .select('id, user_id, username, content, created_at, is_hidden')
    .eq('room_id', roomId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })
    .returns<PostRow[]>()

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <Link href="/works">← 完成作品一覧へ</Link>
        <Link href={`/rooms/${room.id}`}>制作ルームを見る</Link>
      </div>

      <h1 style={{ marginTop: 10 }}>{room.title}</h1>
      <div style={{ marginTop: 6, color: '#444', fontSize: 14 }}>
        {room.work_type} / ❤️ {room.like_count ?? 0}
      </div>

      {postsErr && <p style={{ color: '#b00020' }}>{postsErr.message}</p>}

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>制作ログ（掲示板）</h2>

        {!posts || posts.length === 0 ? (
          <p style={{ color: '#666' }}>投稿がありません。</p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {posts.map((p) => (
              <div
                key={p.id}
                style={{
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 10,
                  padding: 12,
                  background: 'rgba(255,255,255,0.9)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong>{p.username ?? '名無し'}</strong>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {new Date(p.created_at).toLocaleString('ja-JP')}
                  </span>
                </div>
                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {p.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
