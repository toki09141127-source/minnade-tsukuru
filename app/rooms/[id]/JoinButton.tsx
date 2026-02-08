'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase/client'
import Link from 'next/link'

export default function JoinButton({
  roomId,
  roomStatus,
}: {
  roomId: string
  roomStatus: string
}) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')

  const join = async () => {
    setLoading(true)
    setMsg('')

    try {
      // 1) ログイン確認
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser()

      if (userErr) throw userErr
      if (!user) {
        setMsg('参加するにはログインが必要です。')
        setLoading(false)
        return
      }

      // 2) プロフィールから username を取得（必須）
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()

      if (profErr) throw profErr

      const username = (prof?.username ?? '').trim()
      if (!username) {
        setMsg('ユーザー名が未設定です。プロフィールで設定してください。')
        setLoading(false)
        return
      }

      // 3) 参加（既に参加済みでも壊れないように upsert）
      const { error: insErr } = await supabase.from('room_members').upsert(
        {
          room_id: roomId,
          user_id: user.id,
          username,
          role: 'supporter',
        },
        { onConflict: 'room_id,user_id' }
      )

      if (insErr) throw insErr

      setMsg('参加しました！')
    } catch (e: any) {
      setMsg(e?.message ?? '参加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 公開済みは参加できない想定なら無効化（必要なら条件変えてOK）
  const disabled = loading || roomStatus === 'forced_publish'

  return (
    <div>
      <button
        onClick={join}
        disabled={disabled}
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid rgba(0,0,0,0.12)',
          background: disabled ? 'rgba(0,0,0,0.06)' : '#111',
          color: disabled ? '#666' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontWeight: 700,
        }}
      >
        {loading ? '参加中…' : '参加する'}
      </button>

      {msg && (
        <p style={{ marginTop: 8, color: msg.includes('失敗') ? '#b00020' : '#111' }}>
          {msg}{' '}
          {msg.includes('プロフィール') && (
            <Link href="/profile" style={{ marginLeft: 8 }}>
              プロフィールへ
            </Link>
          )}
        </p>
      )}
    </div>
  )
}
