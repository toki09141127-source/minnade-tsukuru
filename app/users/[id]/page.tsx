// app/users/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createUserClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

function isValidUUID(v: string) {
  // 36文字UUID（8-4-4-4-12）
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    v
  )
}

type PageProps = {
  params: { id: string }
}

export default async function UserPage({ params }: PageProps) {
  // 1) idを安全に整形（変な値は弾く）
  const raw = params?.id ?? ''
  const id = (() => {
    try {
      return decodeURIComponent(raw).trim()
    } catch {
      return String(raw).trim()
    }
  })()

  if (!isValidUUID(id)) {
    console.warn('[users/[id]] invalid id:', { raw, id })
    notFound()
  }

  // 2) Supabase（サーバ側ユーザーセッション付き）クライアント
  const supabase = await createUserClient()

  // 3) profiles取得
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, bio')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[users/[id]] profiles select error:', error)
    notFound()
  }

  if (!profile) {
    notFound()
  }

  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-6">
        <Link href="/rooms" className="underline">
          ← ルーム一覧へ
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">{profile.username ?? 'No Name'}</h1>

      {profile.bio ? (
        <p className="whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
      ) : (
        <p className="text-sm opacity-70">自己紹介は未設定です。</p>
      )}
    </main>
  )
}
