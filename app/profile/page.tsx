'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

export default function ProfilePage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
        return
      }

      // すでに username があるなら /rooms に戻す
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profile?.username) {
        router.push('/rooms')
      }
    }
    init()
  }, [router])

  const save = async () => {
    setMessage('保存中…')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setMessage('未ログインです')
      router.push('/login')
      return
    }

    const name = username.trim()
    if (!name) {
      setMessage('ユーザー名を入力してください')
      return
    }

    // profiles に upsert（なければ作る/あれば更新）
    const { error } = await supabase.from('profiles').upsert({
      id: userData.user.id,
      username: name,
    })

    if (error) {
      setMessage('保存エラー: ' + error.message)
      return
    }

    setMessage('保存しました！/rooms に移動します')
    router.push('/rooms')
  }

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>ユーザー名設定</h1>

      <p style={{ marginTop: 8, color: '#666' }}>
        参加者一覧にはこの名前が表示されます。
      </p>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: 'block', fontWeight: 700 }}>ユーザー名</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="例）ねーそ / editor_kun"
          style={{
            marginTop: 8,
            width: '100%',
            border: '1px solid #ccc',
            padding: 10,
            borderRadius: 8,
          }}
        />
      </div>

      <button
        onClick={save}
        style={{
          marginTop: 14,
          padding: '10px 14px',
          border: '1px solid #111',
          borderRadius: 8,
          cursor: 'pointer',
          background: '#111',
          color: '#fff',
        }}
      >
        保存
      </button>

      {message && (
        <p style={{ marginTop: 12, whiteSpace: 'pre-wrap', color: '#b00020' }}>
          {message}
        </p>
      )}
    </div>
  )
}
