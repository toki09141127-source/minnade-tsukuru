// app/works/[id]/page.tsx
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { supabase } from '../../../lib/supabase/client'

type RoomRow = {
  id: string
  title: string
  work_type: string
  status: string
  created_at: string
  expires_at: string | null
  like_count: number | null
}

type PostRow = {
  id: string
  user_id: string
  username: string | null
  content: string
  created_at: string
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString()
  } catch {
    return dt
  }
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const p = await Promise.resolve(params)
  const roomId = p?.id

  if (!roomId) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#b00020' }}>URLの id が取得できませんでした。</p>
        <Link href="/">← トップへ</Link>
      </div>
    )
  }

  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id, title, work_type, status, created_at, expires_at, like_count')
    .eq('id', roomId)
    .single<RoomRow>()

  if (roomErr || !room) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#b00020' }}>取得エラー: {roomErr?.message ?? 'room not found'}</p>
        <Link href="/">← トップへ</Link>
      </div>
    )
  }

  // まだ公開されてないなら案内（事故防止）
  if (room.status === 'open') {
    return (
      <div style={{ padding: 24 }}>
        <h1>作品ページ</h1>
        <p style={{ color: '#666' }}>
          このルームはまだ公開されていません。（status=open）
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href={`/rooms/${room.id}`}>← ルーム詳細へ戻る</Link>
        </p>
      </div>
    )
  }

  const { data: posts, error: postErr } = await supabase
    .from('posts')
    .select('id, user_id, username, content, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .returns<PostRow[]>()

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/">← トップへ</Link>
        <Link href={`/rooms/${room.id}`}>ルーム詳細</Link>
      </div>

      <h1 style={{ marginTop: 10 }}>作品：{room.title}</h1>

      <div style={{ marginTop: 8, fontSize: 14, color: '#444' }}>
        {room.work_type} / status: <strong>{room.status}</strong> / ❤️ {room.like_count ?? 0}
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 14,
          border: '1px solid #ddd',
          borderRadius: 12,
          background: '#fafafa',
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        <div>作成: {fmt(room.created_at)}</div>
        <div>期限: {room.expires_at ? fmt(room.expires_at) : '（未設定）'}</div>
        <div style={{ marginTop: 8, color: '#666' }}>
          ※ ここは「公開済みの完成ページ」です。投稿はできません。
        </div>
      </div>

      <section style={{ marginTop: 18 }}>
        <h2>投稿まとめ</h2>

        {postErr && <p style={{ color: '#b00020' }}>投稿取得エラー: {postErr.message}</p>}

        {!posts || posts.length === 0 ? (
          <p style={{ color: '#666' }}>投稿がありません。</p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {posts.map((p) => (
              <div key={p.id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#666' }}>
                  <strong>{p.username ?? '名無し'}</strong> / {fmt(p.created_at)}
                </div>
                <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{p.content}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
