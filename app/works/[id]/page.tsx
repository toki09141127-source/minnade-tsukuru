// app/works/[id]/page.tsx
import Link from 'next/link'
import { supabase } from '../../../lib/supabase/client'
import AttachmentView from './AttachmentView'
import MarkReadOnView from '../MarkReadOnView' // ✅ 追加
import { statusBadge, categoryBadge, aiBadge, adultBadge } from '@/app/components/RoomBadges'

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
  is_adult?: boolean | null
  category?: string | null
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

// 公開プロフィールリンク用
function UserLink({ username }: { username: string | null }) {
  const name = (username ?? '').trim()
  if (!name) return <strong style={{ opacity: 0.6 }}>名無し</strong>

  return (
    <Link
      href={`/u/${encodeURIComponent(name)}`}
      style={{ fontWeight: 900, textDecoration: 'none', color: '#111' }}
      title="公開プロフィールを見る"
    >
      {name}
    </Link>
  )
}

export default async function WorkDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
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
    .select('id, title, work_type, status, created_at, like_count, is_hidden, deleted_at, concept, ai_level, is_adult, category')
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

  const baseSelect = 'id, user_id, username, content, created_at, is_hidden, post_type, deleted_at, attachment_url, attachment_type'

  const { data: finalPosts } = await supabase
    .from('posts')
    .select(baseSelect)
    .eq('room_id', roomId)
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .eq('post_type', 'final')
    .order('created_at', { ascending: false })
    .returns<PostRow[]>()

  // ログ：post_type が NULL の古い投稿も拾う
  const { data: logPosts } = await supabase
    .from('posts')
    .select(baseSelect)
    .eq('room_id', roomId)
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .or('post_type.is.null,post_type.eq.log')
    .order('created_at', { ascending: true })
    .returns<PostRow[]>()

  const cat = (room.category ?? room.work_type ?? 'その他').trim() || 'その他'

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* ✅ 追加：作品ページを開いた瞬間に既読更新（+キャッシュ削除は MarkReadOnView 側で） */}
      <MarkReadOnView roomId={room.id} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link href="/works">← 完成作品一覧へ</Link>
        <Link href={`/rooms/${room.id}`}>制作ルームを見る</Link>
      </div>

      <h1 style={{ marginTop: 10 }}>{room.title}</h1>

      {/* ✅ 表記統一：バッジで揃える */}
      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {statusBadge(room.status)}
        {categoryBadge(cat)}
        {aiBadge(room.ai_level)}
        {adultBadge(room.is_adult)}
        <span style={{ fontSize: 13, opacity: 0.8 }}>❤️ {room.like_count ?? 0}</span>
      </div>

      {room.concept && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 12,
            background: '#f8f8f8',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>コンセプト</div>
          {room.concept}
        </div>
      )}

      {/* ===== 完成作品 ===== */}
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
                  <UserLink username={p.username} />
                  <span style={{ fontSize: 12, color: '#666' }}>{new Date(p.created_at).toLocaleString('ja-JP')}</span>
                </div>

                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{p.content}</div>

                <AttachmentView path={p.attachment_url} mime={p.attachment_type} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== 制作ログ ===== */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16 }}>制作ログ（掲示板）</h2>

        {!logPosts || logPosts.length === 0 ? (
          <p style={{ color: '#666' }}>投稿がありません。</p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {logPosts.map((p) => (
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
                  <span style={{ fontSize: 12, color: '#666' }}>{new Date(p.created_at).toLocaleString('ja-JP')}</span>
                </div>

                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{p.content}</div>

                <AttachmentView path={p.attachment_url} mime={p.attachment_type} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}