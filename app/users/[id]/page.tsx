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
      style={{
        textDecoration: 'underline',
        wordBreak: 'break-all',
      }}
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
  const id = String(params?.id ?? '').trim()

  if (!id) {
    return notFound()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase env missing')
    return notFound()
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
      id,
      username,
      bio,
      x_url,
      youtube_url,
      instagram_url,
      tiktok_url,
      website_url,
      deleted_at
      `
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('Profile fetch error:', error)
    return notFound()
  }

  if (!data) {
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
        <Link href="/">← トップへ</Link> /{' '}
        <Link href="/rooms">ルーム一覧</Link>
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
          <div style={{ fontWeight: 900, marginBottom: 8 }}>
            SNSリンク
          </div>

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
