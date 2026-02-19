// app/users/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PublicUser = {
  id: string
  username: string | null
  bio: string | null
  x_url: string | null
  youtube_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  website_url: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeUrl(url: string | null) {
  const u = (url ?? '').trim()
  if (!u) return ''
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  return `https://${u}`
}

function SnsLink({ href, label }: { href: string; label: string }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'underline', wordBreak: 'break-all' }}
    >
      {label}
    </a>
  )
}

export default async function PublicProfilePage({
  params,
}: {
  params: { id: string }
}) {
  const raw = String(params?.id ?? '')
  const id = raw.trim()

  // ✅ パラメータがおかしいものは即404
  if (!id || !UUID_RE.test(id)) {
    console.warn('[users/[id]] invalid id:', { raw, id })
    return notFound()
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // ✅ ENVが無いと本番で必ず死ぬ（ここは404ではなく設定ミス）
  if (!url || !anon) {
    console.error('[users/[id]] Missing Supabase env', {
      hasUrl: !!url,
      hasAnon: !!anon,
    })
    // 404にすると原因が隠れるので throw で気づけるようにする
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  // ✅ 認証不要 client（anon）
  // ✅ no-store強制（キャッシュで404が固定される事故を避ける）
  const supabase = createClient(url, anon, {
    global: {
      fetch: (input, init) => {
        return fetch(input, { ...(init ?? {}), cache: 'no-store' })
      },
    },
  })

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, username, bio, x_url, youtube_url, instagram_url, tiktok_url, website_url'
    )
    .eq('id', id)
    .maybeSingle()

  // ✅ Runtime Logsで見えるように必ずログ
  console.log('[users/[id]] fetch result', {
    id,
    hasData: !!data,
    error: error ? { message: error.message, code: (error as any).code } : null,
  })

  if (error) {
    // ここでnotFoundにすると「本当に存在しない」のか「RLS/ENV/通信エラー」なのか見えないので、
    // まずはログで原因追う（必要なら notFound に戻す）
    console.error('[users/[id]] Profile fetch error:', error)
    return notFound()
  }

  if (!data) {
    // ✅ ここが発火してるはず（RLS/参照先ENV違い/実は0件）
    console.warn('[users/[id]] Profile not found (data null):', { id })
    return notFound()
  }

  const u = data as PublicUser

  const x = normalizeUrl(u.x_url)
  const yt = normalizeUrl(u.youtube_url)
  const ig = normalizeUrl(u.instagram_url)
  const tt = normalizeUrl(u.tiktok_url)
  const web = normalizeUrl(u.website_url)
  const hasAnyLink = !!(x || yt || ig || tt || web)

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <p>
        <Link href="/">← トップへ</Link> / <Link href="/rooms">ルーム一覧</Link>
      </p>

      <h1 style={{ marginTop: 8 }}>公開プロフィール</h1>

      <div
        style={{
          marginTop: 14,
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 14,
          padding: 14,
          background: '#fff',
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          {u.username?.trim() ? u.username : 'unknown'}
        </div>

        {u.bio?.trim() ? (
          <div
            style={{
              marginTop: 10,
              whiteSpace: 'pre-wrap',
              borderTop: '1px solid rgba(0,0,0,0.08)',
              paddingTop: 10,
              color: '#222',
            }}
          >
            {u.bio}
          </div>
        ) : (
          <div style={{ marginTop: 10, color: '#666', fontSize: 13 }}>
            紹介文は未設定です。
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            borderTop: '1px solid rgba(0,0,0,0.08)',
            paddingTop: 12,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>SNSリンク</div>

          {!hasAnyLink ? (
            <div style={{ color: '#666', fontSize: 13 }}>
              SNSリンクは未設定です。
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6, fontSize: 14 }}>
              <SnsLink href={x} label="X / Twitter" />
              <SnsLink href={yt} label="YouTube" />
              <SnsLink href={ig} label="Instagram" />
              <SnsLink href={tt} label="TikTok" />
              <SnsLink href={web} label="Website" />
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: '#666' }}>
        ※このページは公開プロフィールです。メール / パスワード等の機密情報は表示しません。
      </div>
    </div>
  )
}
