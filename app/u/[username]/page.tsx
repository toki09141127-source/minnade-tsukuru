// app/u/[username]/page.tsx

import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export default async function PublicProfilePage(
  { params }: { params: Promise<{ username: string }> }
) {
  const resolvedParams = await params
  const rawUsername = resolvedParams?.username ?? ""
  const username = rawUsername.trim()

  console.log("======== PUBLIC PROFILE DEBUG START ========")
  console.log("username param:", username)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log("SUPABASE_URL exists:", !!url)
  console.log("SUPABASE_ANON exists:", !!anon)
  console.log("SUPABASE_ANON length:", anon?.length ?? "undefined")

  if (!url || !anon) {
    console.log("❌ Missing environment variables")
    console.log("======== DEBUG END (env missing) ========")
    return notFound()
  }

  if (!username) {
    console.log("❌ Username empty")
    console.log("======== DEBUG END (username empty) ========")
    return notFound()
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false },
  })

  console.log("Calling Supabase...")

  const { data, error } = await supabase
    .from("public_profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle()

  console.log("Supabase error:", error?.message ?? null)
  console.log("Supabase data exists:", !!data)
  console.log("======== DEBUG END ========")

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