// app/u/[username]/page.tsx
import { notFound } from "next/navigation"
import { createUserClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

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

export default async function PublicProfilePage({ params }: PageProps) {
  const raw = params.username ?? ""

  // URLエンコード対策（/u/%E3%82%8F... → /u/わさび）
  const username = (() => {
    try {
      return decodeURIComponent(raw).trim()
    } catch {
      return raw.trim()
    }
  })()

  if (!username) return notFound()

  const supabase = await createUserClient()

  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, username, bio, avatar_url, links")
    .eq("username", username)
    .maybeSingle()

  if (error || !data) return notFound()

  const bio = safeStr(data.bio)

  const links = (data.links ?? {}) as Links
  const xUrl = safeStr(links.x_url)
  const youtubeUrl = safeStr(links.youtube_url)
  const instagramUrl = safeStr(links.instagram_url)
  const tiktokUrl = safeStr(links.tiktok_url)
  const websiteUrl = safeStr(links.website_url)

  const hasAnyLinks =
    xUrl !== "" ||
    youtubeUrl !== "" ||
    instagramUrl !== "" ||
    tiktokUrl !== "" ||
    websiteUrl !== ""

  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">{data.username}</h1>

      {/* ✅ 紹介文は常に表示 */}
      <section className="mb-8">
        <h2 className="text-base font-bold mb-2">紹介文</h2>
        {bio !== "" ? (
          <p className="text-gray-700 whitespace-pre-wrap">{bio}</p>
        ) : (
          <p className="text-gray-500">自己紹介が設定されていません。</p>
        )}
      </section>

      {/* ✅ SNSリンク欄も常に表示 */}
      <section>
        <h2 className="text-base font-bold mb-2">SNSリンク</h2>

        {hasAnyLinks ? (
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
        ) : (
          <p className="text-gray-500">SNSのリンクが設定されていません。</p>
        )}
      </section>
    </main>
  )
}