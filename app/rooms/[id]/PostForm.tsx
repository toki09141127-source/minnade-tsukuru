'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'

type Props = {
  roomId: string
  disabled?: boolean
}

export default function PostForm({ roomId, disabled }: Props) {
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setError('')

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      setError('ログイン情報が取得できません')
      setLoading(false)
      return
    }

    const { error: insertErr } = await supabase.from('posts').insert({
      room_id: roomId,
      user_id: user.id,
      content,
    })

    if (insertErr) {
      setError(insertErr.message)
    } else {
      setContent('')
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="アイデア・意見・思いつきを自由に書いてください"
        disabled={disabled || loading}
        rows={4}
        style={{
          width: '100%',
          padding: 10,
          borderRadius: 8,
          border: '1px solid #ccc',
          resize: 'vertical',
        }}
      />

      {error && (
        <p style={{ marginTop: 6, color: '#b00020', fontSize: 13 }}>
          {error}
        </p>
      )}

      <div style={{ marginTop: 8 }}>
        <button
          type="submit"
          disabled={disabled || loading || !content.trim()}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: 'none',
            background: disabled ? '#aaa' : '#2563eb',
            color: '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '投稿中…' : '投稿する'}
        </button>
      </div>
    </form>
  )
}
