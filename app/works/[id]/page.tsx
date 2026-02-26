// app/works/[id]/page.tsx
import Link from 'next/link'
import PostAttachment from '../PostAttachment'
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
  ai_level?: string | null
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

function aiLabel(v: string | null | undefined) {
  const s = (v ?? '').toLowerCase()
  if (s === 'high') return '多め'
  if (s === 'mid') return 'ふつう'
  if (s === 'low') return '少し'
  return 'なし'
}

// ✅ 公開プロフィールリンク用
function UserLink({ username }: { username: string | null }) {
  const name = (username ?? '').trim()

  if (!name) {
    return <strong style={{ opacity: 0.6 }}>名無し</strong>
  }

  return (
    <Link
      href={`/u/${encodeURIComponent(name)}`}
      style={{
        fontWeight: 900,
        textDecoration: 'none',
        color: '#111',
      }}
      title="公開プロフィールを見る"
    >
      {name}
    </Link>
  )
}

function pill(bg: string, fg: string) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background: bg,
    color: fg,
    border: '1px solid rgba(0,0,0,0.06)',
  } as const
}

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
    .select('id, title, work_type, status, created_at, like_count, is_hidden, deleted_at, concept, ai_level')
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
    .in('post_type', ['log', ''])
    .order('created_at', { ascending: true })
    .returns<PostRow[]>()

  const normalizedLogPosts = (logPosts ?? []).filter((p) => !p.post_type || p.post_type === 'log')

  const ai = aiLabel(room.ai_level)
  const likes = room.like_count ?? 0

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* header nav */}
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

      <h1 style={{ marginTop: 10, marginBottom: 6, fontSize: 24, fontWeight: 900 }}>{room.title}</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={pill('rgba(59,130,246,0.14)', '#1e40af')}>公開済み</span>
        <span style={pill('rgba(0,0,0,0.06)', '#111')}>{room.work_type}</span>
        <span style={pill('rgba(16,185,129,0.14)', '#065f46')}>AI:{ai}</span>
        <span style={pill('rgba(239,68,68,0.10)', '#7f1d1d')}>❤️ {likes}</span>
      </div>

      {room.concept && room.concept.trim() && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.92)',
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, opacity: 0.85 }}>コンセプト</div>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#222' }}>
            {room.concept}
          </div>
        </div>
      )}

      {/* errors (optional display) */}
      {(finalErr || logErr) && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: 'rgba(176,0,32,0.08)' }}>
          <div style={{ fontWeight: 900, color: '#b00020' }}>読み込みエラー</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#7a0016' }}>
            {finalErr?.message ? `final: ${finalErr.message}` : ''}
            {finalErr?.message && logErr?.message ? ' / ' : ''}
            {logErr?.message ? `log: ${logErr.message}` : ''}
          </div>
        </div>
      )}

      {/* ===== 完成作品 ===== */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>完成作品（最終提出）</h2>

        {!finalPosts || finalPosts.length === 0 ? (
          <p style={{ marginTop: 10, color: '#666' }}>最終提出がありません。</p>
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
                  <UserLink username={p.username} />
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {new Date(p.created_at).toLocaleString('ja-JP')}
                  </span>
                </div>

                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{p.content}</div>

                {/* ✅ 画像表示（署名URL取得） */}
                <PostAttachment attachment_url={p.attachment_url} attachment_type={p.attachment_type} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== 制作ログ ===== */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>制作ログ（掲示板）</h2>

        {!normalizedLogPosts || normalizedLogPosts.length === 0 ? (
          <p style={{ marginTop: 10, color: '#666' }}>投稿がありません。</p>
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
                  <UserLink username={p.username} />
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {new Date(p.created_at).toLocaleString('ja-JP')}
                  </span>
                </div>

                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{p.content}</div>

                {/* ✅ 画像表示（署名URL取得） */}
                <PostAttachment attachment_url={p.attachment_url} attachment_type={p.attachment_type} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}