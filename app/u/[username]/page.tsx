// app/u/[username]/page.tsx

import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export default async function PublicProfilePage(
  { params }: { params: Promise<{ username: string }> }
) {
  const resolvedParams = await params
  const rawUsername = resolvedParams?.username ?? ""

  // ✅ ここが今回の修正ポイント
  const username = decodeURIComponent(rawUsername).trim()

  console.log("======== PUBLIC PROFILE DEBUG START ========")
  console.log("username param:", username)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon || !username) {
    return notFound()
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase
    .from("public_profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle()

  console.log("Supabase data exists:", !!data)

  if (error || !data) {
    return notFound()
  }

  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-4">{data.username}</h1>
      <p className="text-gray-600 whitespace-pre-wrap">
        {data.bio ?? "自己紹介はまだありません。"}
      </p>
    </main>
  )
}