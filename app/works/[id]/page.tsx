// app/works/[id]/page.tsx
import Link from 'next/link'
import { supabase } from '../../../lib/supabase/client'

type RoomRow = {
  id: string
  title: string
  type: string | null
  status: string
  created_at: string
  like_count: number | null
  is_hidden: boolean
  deleted_at?: string | null
  member_count?: number | null
  concept?: string | null
}

type PostRow = {
  id: string
  user_id: string
  username: string | null
  content: string
  created_at: string
  is_hidden: boolean
  deleted_at?: string | null
  phase?: string | null // 'log' | 'final' | null
  attachment_url?: string | null
  attachment_type?: string | null
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

  // ✅ rooms ではなく view を参照（type/status/member_count などが揃う）
  const { data: room, error: roomErr } = await supabase
    .from('rooms_with_counts_v2')
    .select('id, title, type, status, created_at, like_count, is_hidden, deleted_at, member_count, concept')
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

  // ✅ 最終提出（final）
  const { data: finals, error: finalsErr } = await supabase
    .from('posts')
    .select('id, user_id, username, content, created_at, is_hidden, deleted_at, phase, attachment_url, attachment_type')
    .eq('room_id', roomId)
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .eq('phase', 'final')
    .order('created_at', { ascending: false })
    .returns<PostRow[]>()

  // ✅ 制作ログ（log / null）
  const { data: logs, error: logsErr } = await supabase
    .from('posts')
    .select('id, user_id, username, content, created_at, is_hidden, deleted_at, phase, attachment_url, attachment_type')
    .eq('room_id', roomId)
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .or('phase.is.null,phase.eq.log')
    .order('created_at', { ascending: true })
    .returns<PostRow[]>()

  const postsErr = finalsErr ?? logsErr

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <Link href="/works">← 完成作品一覧へ</Link>
        <Link href={`/rooms/${room.id}`}>制作ルームを見る</Link>
      </div>

      <h1 style={{ marginTop: 10 }}>{room.title}</h1>
      <div style={{ marginTop: 6, color: '#444', fontSize: 14 }}>
        {room.type ?? '未設定'} / ❤️ {room.like_count ?? 0} / 👥 {room.member_count ?? 0}
      </div>

      {room.concept && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.9)',
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>作品コンセプト</div>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{room.concept}</div>
        </div>
      )}

      {postsErr && <p style={{ color: '#b00020' }}>{postsErr.message}</p>}

      {/* ✅ 最終提出（上） */}
      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>完成作品（最終提出）</h2>

        {!finals || finals.length === 0 ? (
          <p style={{ color: '#666' }}>最終提出がまだありません。</p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {finals.map((p) => (
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

                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{p.content}</div>

                {/* いま attachment_url があるなら暫定表示（Phase3でsigned URLに置換） */}
                {p.attachment_url && p.attachment_type?.startsWith('image/') && (
                  <div style={{ marginTop: 10 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.attachment_url}
                      alt="attachment"
                      style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ✅ 制作ログ（下） */}
      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 16 }}>制作ログ（掲示板）</h2>

        {!logs || logs.length === 0 ? (
          <p style={{ color: '#666' }}>投稿がありません。</p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {logs.map((p) => (
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
                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{p.content}</div>

                {p.attachment_url && p.attachment_type?.startsWith('image/') && (
                  <div style={{ marginTop: 10 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.attachment_url}
                      alt="attachment"
                      style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
