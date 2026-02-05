'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase/client'

export default function JoinButton({
  roomId,
  roomStatus,
}: {
  roomId: string
  roomStatus: string
}) {
  const [joined, setJoined] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needProfile, setNeedProfile] = useState(false)

  useEffect(() => {
    const init = async () => {
      setError('')
      setNeedProfile(false)

      const { data: userRes } = await supabase.auth.getUser()
      const u = userRes.user
      if (!u) return

      const { data: mem } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', u.id)
        .maybeSingle()

      setJoined(!!mem)
    }

    init()
  }, [roomId])

  const join = async () => {
    setError('')
    setNeedProfile(false)

    if (roomStatus !== 'open') {
      setError('このルームは現在参加できません（status=open のときのみ）')
      return
    }
    if (joined) return

    setLoading(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) {
        setError('ログインしてください')
        return
      }

      // ✅ username 未設定チェック
      const { data: prof } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()

      const uname = (prof?.username ?? '').trim()
      if (!uname) {
        setNeedProfile(true)
        setError('参加するにはユーザー名の設定が必要です')
        return
      }

      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) {
        setError('ログインしてください')
        return
      }

      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId }),
      })

      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? '参加に失敗しました')
        return
      }

      setJoined(true)
    } catch (e: any) {
      setError(e?.message ?? '参加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={join}
        disabled={loading || joined}
        style={{
          padding: '10px 14px',
          border: '1px solid #111',
          borderRadius: 8,
          cursor: joined ? 'default' : 'pointer',
          background: joined ? '#ddd' : '#111',
          color: joined ? '#333' : '#fff',
        }}
      >
        {joined ? '参加済み' : loading ? '参加中…' : '参加する'}
      </button>

      {error && (
        <p style={{ marginTop: 8, color: '#b00020' }}>
          {error}{' '}
          {needProfile && (
            <>
              <Link href="/profile">→ プロフィールへ</Link>
            </>
          )}
        </p>
      )}
    </div>
  )
}
