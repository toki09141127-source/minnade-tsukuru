'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase/client'

export default function AuthHeader() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    // ここでリロードしておくと表示のズレが起きにくい
    location.href = '/'
  }

  return (
    <header
      style={{
        padding: 16,
        borderBottom: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Link href="/">みんなで作ろう（仮）</Link>

      {email ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/profile">プロフィール</Link>
          <span>{email}</span>
          <button onClick={signOut}>ログアウト</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/login">ログイン</Link>
        </div>
      )}
    </header>
  )
}
