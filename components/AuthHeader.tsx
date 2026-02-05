'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase/client'


export default function AuthHeader() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    // 初期状態
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))

    // 変化監視
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <header style={{ padding: 16, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
      <Link href="/">みんなで作ろう（仮）</Link>

      {email ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>{email}</span>
          <button onClick={signOut}>ログアウト</button>
        </div>
      ) : (
        <Link href="/login">ログイン</Link>
      )}
    </header>
  )
}
