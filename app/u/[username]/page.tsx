// app/u/[username]/page.tsx
import { notFound } from "next/navigation"
import { createUserClient } from "@/lib/supabase/server"

// ✅ 404キャッシュを確実に潰す（App RouterのnotFoundキャッシュ対策）
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

type PageProps = { params: { username: string } }

type Links = {
  x_url?: string | null
  youtube_url?: string | null
  instagram_url?: string | null
  tiktok_url?: string | null
  website_url?: string | null
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : ""
}

function normalizeUsername(raw: string) {
  const s = (raw ?? "").trim()
  if (!s) return ""
  try {
    return decodeURIComponent(s).trim()
  } catch {
    return s
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const username = normalizeUsername(params?.username ?? "")
  if (!username) return notFound()

  const supabase = await createUserClient()

  const { data, error } = await supabase
    // 注意：テーブル名が public.public_profiles なら "public_profiles"
    // もし public.public_public_profiles みたいに schema 付きで扱ってるなら合わせて変更
    .from("public_profiles")
    .select("id, username, bio, avatar_url, links")
    .eq("username", username)
    .maybeSingle()

  if (error || !data) return notFound()

  const links = (data.links ?? {}) as Links

  const xUrl = safeStr(links.x_url)
  const youtubeUrl = safeStr(links.youtube_url)
  const instagramUrl = safeStr(links.instagram_url)
  const tiktokUrl = safeStr(links.tiktok_url)
  const websiteUrl = safeStr(links.website_url)

  const hasAny =
    xUrl !== "" ||
    youtubeUrl !== "" ||
    instagramUrl !== "" ||
    tiktokUrl !== "" ||
    websiteUrl !== ""

  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">{data.username}</h1>

      <section className="mb-8">
        <h2 className="text-base font-bold mb-2">自己紹介</h2>
        <p className="text-gray-700 whitespace-pre-wrap">
          {safeStr(data.bio) !== "" ? data.bio : "自己紹介が設定されていません"}
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold mb-2">SNSリンク</h2>

        {!hasAny ? (
          <p className="text-gray-700 text-sm">SNSのリンクが設定されていません</p>
        ) : (
          <div className="grid gap-2 text-sm">
            {xUrl !== "" && (
              <a className="underline" href={xUrl} target="_blank" rel="noreferrer">
                X / Twitter
              </a>
            )}
            {youtubeUrl !== "" && (
              <a className="underline" href={youtubeUrl} target="_blank" rel="noreferrer">
                YouTube
              </a>
            )}
            {instagramUrl !== "" && (
              <a className="underline" href={instagramUrl} target="_blank" rel="noreferrer">
                Instagram
              </a>
            )}
            {tiktokUrl !== "" && (
              <a className="underline" href={tiktokUrl} target="_blank" rel="noreferrer">
                TikTok
              </a>
            )}
            {websiteUrl !== "" && (
              <a className="underline" href={websiteUrl} target="_blank" rel="noreferrer">
                Website
              </a>
            )}
          </div>
        )}
      </section>
    </main>
  )
}