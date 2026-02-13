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
  concept?: string | null
}

type PostRow = {
  id: string
  user_id: string
  username: string | null
  content: string
  created_at: string
  is_hidden: boolean
  post_type?: string | null
  deleted_at?: string | null
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

  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id, title, work_type, status, created_at, like_count, is_hidden, deleted_at, concept')
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

  // 完成作品ページなので forced_publish のみ表示（仕様通り）
  if (room.status !== 'forced_publish') {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#b00020' }}>このルームはまだ公開されていません。</p>
        <Link href={`/rooms/${room.id}`}>← ルームへ</Link>
      </div>
    )
  }

  // ✅ final / log を分離して取得（最小改修・明快・安定）
  const baseSelect =
    'id, user_id, username, content, created_at, is_hidden, post_type, deleted_at, attachment_url, attachment_type'

  const { data: finalPosts, error: finalErr } = await supabase
    .from('posts')
    .select(baseSelect)
    .eq('room_id', roomId)
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .eq('post_type', 'final')
    .order('created_at', { ascending: false })
    .returns<PostRow[]>()

  const { data: logPosts, error: logErr } = await supabase
    .from('posts')
    .select(baseSelect)
    .eq('room_id', roomId)
    .eq('is_hidden', false)
    .is('deleted_at', null)
    // post_type が null（既存データ）も log として扱う
    .in('post_type', ['log', ''])
    .order('created_at', { ascending: true })
    .returns<PostRow[]>()

  // 既存データに post_type が NULL の投稿がある可能性が高いので、サーバ側で補正
  const normalizedLogPosts =
    (logPosts ?? []).filter((p) => !p.post_type || p.post_type === 'log')

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Link href="/works">← 完成作品一覧へ</Link>
        <Link href={`/rooms/${room.id}`}>制作ルームを見る</Link>
      </div>

      <h1 style={{ marginTop: 10 }}>{room.title}</h1>
      <div style={{ marginTop: 6, color: '#444', fontSize: 14 }}>
        {room.work_type} / ❤️ {room.like_count ?? 0}
      </div>

      {room.concept && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.85)',
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>作品コンセプト</div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{room.concept}</div>
        </div>
      )}

      {(finalErr || logErr) && (
        <p style={{ marginTop: 12, color: '#b00020' }}>
          {finalErr?.message || logErr?.message}
        </p>
      )}

      {/* ✅ 最終提出（final） */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16 }}>完成作品（最終提出）</h2>

        {!finalPosts || finalPosts.length === 0 ? (
          <p style={{ color: '#666' }}>最終提出がありません。</p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {finalPosts.map((p) => (
              <div
                key={p.id}
                style={{
                  border: '1px solid rgba(0,0,0,0.10)',
                  borderRadius: 12,
                  padding: 12,
                  background: 'rgba(255,255,255,0.92)',
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

                {/* ✅ 画像表示（最小追加） */}
                {p.attachment_url &&
                  (p.attachment_type?.startsWith('image/') || p.attachment_type === 'image') && (
                    <div style={{ marginTop: 10 }}>
                      <img
                        src={p.attachment_url}
                        alt="attachment"
                        loading="lazy"
                        style={{
                          width: '100%',
                          maxHeight: 520,
                          objectFit: 'contain',
                          borderRadius: 12,
                          border: '1px solid rgba(0,0,0,0.10)',
                          background: 'rgba(0,0,0,0.02)',
                        }}
                      />
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ✅ 制作ログ（log） */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16 }}>制作ログ（掲示板）</h2>

        {!normalizedLogPosts || normalizedLogPosts.length === 0 ? (
          <p style={{ color: '#666' }}>投稿がありません。</p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {normalizedLogPosts.map((p) => (
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

                {/* ✅ 画像表示（最小追加） */}
                {p.attachment_url &&
                  (p.attachment_type?.startsWith('image/') || p.attachment_type === 'image') && (
                    <div style={{ marginTop: 10 }}>
                      <img
                        src={p.attachment_url}
                        alt="attachment"
                        loading="lazy"
                        style={{
                          width: '100%',
                          maxHeight: 520,
                          objectFit: 'contain',
                          borderRadius: 12,
                          border: '1px solid rgba(0,0,0,0.10)',
                          background: 'rgba(0,0,0,0.02)',
                        }}
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
