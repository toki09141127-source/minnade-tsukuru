// app/components/LogoutButton.tsx
'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  const onLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={onLogout}
      style={{
        padding: '8px 12px',
        borderRadius: 10,
        border: '1px solid #111',
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      ログアウト
    </button>
  )
}
