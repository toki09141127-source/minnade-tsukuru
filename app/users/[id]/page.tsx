// app/users/[id]/page.tsx

import { notFound } from "next/navigation"
import { createUserClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isValidUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  )
}

type PageProps = {
  params: {
    id: string
  }
}

export default async function UserPage({ params }: PageProps) {
  const raw = params.id ?? ""

  const id = (() => {
    try {
      return decodeURIComponent(raw).trim()
    } catch {
      return raw.trim()
    }
  })()

  if (!isValidUUID(id)) {
    return notFound()
  }

  const supabase = await createUserClient()

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, bio")
    .eq("id", id)
    .maybeSingle()

  if (error || !profile) {
    return notFound()
  }

  return (
    <main className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">
        {profile.username ?? "No Name"}
      </h1>

      <p className="text-gray-600 whitespace-pre-wrap">
        {profile.bio ?? "自己紹介はまだありません。"}
      </p>
    </main>
  )
}
