// app/users/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createUserClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { id?: string }
}

function isUuidLike(v: string) {
  // Postgres uuid 形式（v1-v5 を許容）をざっくり許可
  // 8-4-4-4-12 hex
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    v
  )
}

export default async function UserPage({ params }: PageProps) {
  // 1) id の取り出し（Next が変な値を渡すケース/エンコードを想定）
  const raw = params?.id ?? ''
  const id = (() => {
    try {
      return decodeURIComponent(raw).trim()
    } catch {
      return String(raw).trim()
    }
  })()

  // 2) UUID検証（ここで落ちると Vercel Logs に原因が残る）
  if (!id || !isUuidLike(id)) {
    console.warn('[users/[id]] invalid id:', { raw, id })
    notFound()
  }

  // 3) Supabase 取得（RLS / anon read が効いてれば読める）
  const supabase = await createUserClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, bio, avatar_url, deleted_at')
    .eq('id', id)
    .maybeSingle()

  // 4) DBエラーは「404にせず」画面にエラー表示＋ログ出し（原因追跡しやすくする）
  if (error) {
    console.error('[users/[id]] supabase error:', {
      id,
      message: error.message,
      code: (error as any).code,
      details: (error as any).details,
      hint: (error as any).hint,
    })

    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-bold">プロフィールの取得に失敗しました</h1>
        <p className="mt-2 text-sm opacity-80">
          サーバ側でプロフィールを読み込めませんでした。Vercel Logs の
          <code className="mx-1 rounded bg-black/5 px-1">[users/[id]] supabase error</code>
          を確認してください。
        </p>

        <div className="mt-4 rounded border p-3 text-sm">
          <div>
            <span className="font-semibold">userId:</span> {id}
          </div>
          <div className="mt-1">
            <span className="font-semibold">message:</span> {error.message}
          </div>
        </div>

        <div className="mt-6">
          <Link className="underline" href="/profile">
            自分のプロフィールへ戻る
          </Link>
        </div>
      </main>
    )
  }

  // 5) 取得できない / 論理削除なら 404（仕様に合わせて）
  if (!data || data.deleted_at) {
    console.warn('[users/[id]] not found or deleted:', { id, found: !!data })
    notFound()
  }

  const username = (data.username ?? '').toString().trim() || '名無し'
  const bio = (data.bio ?? '').toString().trim()
  const avatarUrl = (data.avatar_url ?? '').toString().trim()

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-full border bg-black/5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={`${username} avatar`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm opacity-60">
              NO IMG
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{username}</h1>
          <p className="mt-1 break-all text-xs opacity-60">{data.id}</p>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold opacity-80">自己紹介</h2>
        <div className="mt-2 rounded border p-4">
          {bio ? (
            <p className="whitespace-pre-wrap leading-relaxed">{bio}</p>
          ) : (
            <p className="text-sm opacity-60">（未入力）</p>
          )}
        </div>
      </section>

      <div className="mt-8 flex gap-3">
        <Link className="rounded border px-3 py-2 text-sm" href="/rooms">
          制作ルーム一覧へ
        </Link>
        <Link className="rounded border px-3 py-2 text-sm" href="/profile">
          自分のプロフィールへ
        </Link>
      </div>
    </main>
  )
}
