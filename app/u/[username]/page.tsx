// app/u/[username]/page.tsx
import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

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

  const username = (() => {
    try {
      return decodeURIComponent(raw).trim()
    } catch {
      return raw.trim()
    }
  })()

  if (!username) return notFound()

  // 🔥 公開ページなので anon クライアントを使う
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
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
    <main className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">{data.username}</h1>

      <p className="text-gray-600 whitespace-pre-wrap">
        {data.bio ?? "自己紹介はまだありません。"}
      </p>

      {hasAny && (
        <section className="mt-6">
          <h2 className="text-base font-bold mb-2">SNSリンク</h2>

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
        </section>
      )}
    </main>
  )
}
