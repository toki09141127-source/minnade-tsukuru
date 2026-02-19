import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createUserClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

function isValidUUID(v: string) {
  return /^[0-9a-fA-F-]{36}$/.test(v)
}

export default async function UserPage({
  params,
}: {
  params: { id: string }
}) {
  const id = decodeURIComponent(params.id ?? '').trim()

  if (!isValidUUID(id)) {
    notFound()
  }

  const supabase = await createUserClient() // ← ★これが重要

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, bio')
    .eq('id', id)
    .maybeSingle()

  if (!profile) {
    notFound()
  }

  return (
    <main className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">
        {profile.username ?? 'No Name'}
      </h1>

      {profile.bio && (
        <p className="text-gray-600 whitespace-pre-wrap">
          {profile.bio}
        </p>
      )}

      <div className="mt-6">
        <Link href="/" className="text-blue-500 underline">
          トップへ戻る
        </Link>
      </div>
    </main>
  )
}
