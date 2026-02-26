import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import SeenMarker from './SeenMarker'

export const dynamic = 'force-dynamic'

type Params = { id?: string }

type RoomRow = {
  id: string
  title: string | null
  status: string
  concept: string | null
  is_adult: boolean | null
  like_count: number | null
  created_at: string | null
  ended_at?: string | null
  deleted_at: string | null
  is_hidden: boolean | null
  ai_level?: string | null
}

type PostRow = {
  id: string
  room_id: string
  user_id: string
  username: string | null
  content: string | null
  post_type: 'final' | 'log' | string
  created_at: string
  deleted_at: string | null
  attachment_url: string | null // ← Storageのpathが入る前提
  attachment_type: string | null
}

const BUCKET = 'room_uploads'
const SIGN_EXPIRES = 60 * 10 // 10分（短め推奨）

function safeDate(d: string | null | undefined) {
  if (!d) return ''
  const ms = new Date(d).getTime()
  if (Number.isNaN(ms)) return ''
  return new Date(d).toLocaleString()
}

async function fetchRoom(roomId: string): Promise<RoomRow | null> {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('id, title, status, concept, is_adult, like_count, created_at, ended_at, deleted_at, is_hidden, ai_level')
    .eq('id', roomId)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as any
}

async function fetchFinalPost(roomId: string): Promise<PostRow | null> {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('id, room_id, user_id, username, content, post_type, created_at, deleted_at, attachment_url, attachment_type')
    .eq('room_id', roomId)
    .eq('post_type', 'final')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as any
}

async function signIfNeeded(path: string | null) {
  if (!path) return null

  // 既にURLっぽいものが入ってしまっても壊れない保険
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGN_EXPIRES)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export default async function WorkDetailPage({ params }: { params: Params | Promise<Params> }) {
  const p = await Promise.resolve(params)
  const roomId = p?.id ?? ''

  if (!roomId || roomId.length < 10) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 800 }}>id が不正です</p>
        <Link href="/works">← 完成作品一覧へ</Link>
      </div>
    )
  }

  const room = await fetchRoom(roomId)

  if (!room || room.deleted_at || room.is_hidden) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'crimson', fontWeight: 800 }}>作品が見つかりません</p>
        <Link href="/works">← 完成作品一覧へ</Link>
      </div>
    )
  }

  const finalPost = await fetchFinalPost(roomId)
  const signedUrl = await signIfNeeded(finalPost?.attachment_url ?? null)

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* ✅ 作品ページを開いたら既読更新（ログイン時のみ） */}
      <SeenMarker roomId={roomId} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <Link href="/works">← 完成作品一覧へ</Link>
        <Link href={`/rooms/${roomId}`}>制作ルームを見る</Link>
      </div>

      <h1 style={{ marginTop: 10 }}>{room.title ?? '（無題）'}</h1>

      <div style={{ marginTop: 8, fontSize: 13, color: '#555', lineHeight: 1.8 }}>
        <div>
          <b>ステータス:</b> {room.status}
          {'  '}|{'  '}
          <b>🤖AI:</b> {room.ai_level ?? '-'}
          {'  '}|{'  '}
          <b>❤️</b> {room.like_count ?? 0}
          {'  '}|{'  '}
          <b>作成:</b> {safeDate(room.created_at)}
        </div>
      </div>

      {room.concept && (
        <div
          style={{
            marginTop: 14,
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

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>完成作品（最終提出）</div>

        {!finalPost ? (
          <div style={{ opacity: 0.75 }}>最終提出が見つかりません。</div>
        ) : (
          <div
            style={{
              border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: 14,
              padding: 14,
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 900 }}>{finalPost.username ?? 'unknown'}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{safeDate(finalPost.created_at)}</div>
            </div>

            {signedUrl && (
              <div style={{ marginTop: 12 }}>
                {/* next/image じゃなくて img にしておく（ドメイン設定で詰まりにくい） */}
                <img
                  src={signedUrl}
                  alt="attachment"
                  style={{
                    width: '100%',
                    maxHeight: 560,
                    objectFit: 'contain',
                    borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.06)',
                    background: '#fafafa',
                  }}
                />
              </div>
            )}

            {finalPost.content && (
              <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                {finalPost.content}
              </div>
            )}

            {/* 画像が出ない時の保険表示（pathがnull/署名失敗） */}
            {!signedUrl && finalPost.attachment_url && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#b00020' }}>
                画像URLの署名に失敗しました（attachment_url は存在します）
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}