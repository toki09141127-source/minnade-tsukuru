// app/users/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createUserClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

function isValidUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
}

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v).trim()
  } catch {
    return String(v).trim()
  }
}

type PageProps = {
  params: { id: string }
}

export default async function UserPage({ params }: PageProps) {
  // 1) id 正規化
  const raw = params?.id ?? ''
  const id = safeDecode(raw)

  // 2) UUID 検証（変な値が来たら 404）
  if (!isValidUUID(id)) {
    console.warn('[users/[id]] invalid id:', { raw, id })
    notFound()
  }

  // 3) Supabase（※ここが重要：await）
  const supabase = await createUserClient()

  // 4) プロフィール取得
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
    // RLS で見えない / そもそも存在しない
    notFound()
  }

  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{profile.username ?? 'No Name'}</h1>
        <Link href="/rooms" className="text-sm underline">
          ルーム一覧へ
        </Link>
      </div>

      <section className="rounded-xl border p-5">
        <div className="text-sm text-gray-600 mb-2">ユーザーID</div>
        <div className="font-mono text-xs break-all mb-5">{profile.id}</div>

        <div className="text-sm text-gray-600 mb-2">自己紹介</div>
        <p className="whitespace-pre-wrap">
          {profile.bio?.trim() ? profile.bio : '（未設定）'}
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href={`/works?user=${profile.id}`}
            className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white text-sm"
          >
            この人の完成作品
          </Link>

          <Link
            href="/profile"
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm"
          >
            自分のプロフィール編集
          </Link>
        </div>
      </section>
    </main>
  )
}
