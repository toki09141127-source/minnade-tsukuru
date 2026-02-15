// app/rooms/[id]/RoomDetailClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import BoardClient from './BoardClient'

type RoomFlags = {
  id: string
  status: string
  enable_core_approval: boolean
  enable_core_invite: boolean
}

type MyMember = {
  role: 'creator' | 'core' | 'supporter'
  joined_at: string
  left_at: string | null
} | null

type JoinRequestRow = {
  id: string
  user_id: string
  created_at: string
}

export default function RoomDetailClient({ room }: { room: RoomFlags }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [myMember, setMyMember] = useState<MyMember>(null)
  const [checking, setChecking] = useState(true)

  const [inviteCode, setInviteCode] = useState('')
  const [pendingRequests, setPendingRequests] = useState<JoinRequestRow[]>([])
  const [busy, setBusy] = useState(false)

  const isOpen = room.status === 'open'

  const myRole = myMember?.left_at == null ? myMember?.role : null

  const coreLeaveAllowed = useMemo(() => {
    if (myRole !== 'core' || !myMember?.joined_at) return false
    const joinedAt = new Date(myMember.joined_at).getTime()
    if (Number.isNaN(joinedAt)) return false
    return Date.now() - joinedAt <= 5 * 60 * 1000
  }, [myRole, myMember?.joined_at])

  const canPost = isOpen && (myRole === 'supporter' || myRole === 'core' || myRole === 'creator')

  const getToken = async () => {
    const sess = await supabase.auth.getSession()
    return sess.data.session?.access_token ?? null
  }

  const reloadMyState = async () => {
    setChecking(true)

    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id ?? null
    setUserId(uid)

    if (!uid) {
      setMyMember(null)
      setPendingRequests([])
      setChecking(false)
      return
    }

    // 自分の参加状態
    const { data: mem } = await supabase
      .from('room_members')
      .select('role, joined_at, left_at')
      .eq('room_id', room.id)
      .eq('user_id', uid)
      .maybeSingle()

    setMyMember((mem as any) ?? null)

    // creatorなら pending一覧（RLSでcreatorのみ見える）
    if (mem?.left_at == null && mem?.role === 'creator') {
      const { data: reqs } = await supabase
        .from('room_join_requests')
        .select('id, user_id, created_at')
        .eq('room_id', room.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      setPendingRequests(((reqs as any) ?? []) as JoinRequestRow[])
    } else {
      setPendingRequests([])
    }

    setChecking(false)
  }

  useEffect(() => {
    reloadMyState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id])

  // --- actions ---
  const joinSupporter = async () => {
    if (!isOpen) return alert('このルームは参加できません')
    const token = await getToken()
    if (!token) return alert('ログインしてください')

    setBusy(true)
    try {
      const res = await fetch('/api/rooms/join-supporter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return alert(json?.error ?? '参加に失敗しました')
      await reloadMyState()
    } finally {
      setBusy(false)
    }
  }

  const requestCore = async () => {
    if (!isOpen) return alert('このルームは申請できません')
    if (!room.enable_core_approval) return
    const token = await getToken()
    if (!token) return alert('ログインしてください')

    setBusy(true)
    try {
      const res = await fetch('/api/rooms/request-core', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return alert(json?.error ?? '申請に失敗しました')
      alert('core申請を送信しました')
      await reloadMyState()
    } finally {
      setBusy(false)
    }
  }

  const joinCoreByInvite = async () => {
    if (!isOpen) return alert('このルームは参加できません')
    if (!room.enable_core_invite) return
    const code = inviteCode.trim()
    if (!code) return alert('招待コードを入力してください')

    const token = await getToken()
    if (!token) return alert('ログインしてください')

    setBusy(true)
    try {
      const res = await fetch('/api/rooms/join-core-by-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id, inviteCode: code }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return alert(json?.error ?? '参加に失敗しました')
      await reloadMyState()
    } finally {
      setBusy(false)
    }
  }

  const leaveRoom = async () => {
    const token = await getToken()
    if (!token) return alert('ログインしてください')

    if (!confirm('退出しますか？')) return

    setBusy(true)
    try {
      const res = await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return alert(json?.error ?? '退出に失敗しました')
      await reloadMyState()
    } finally {
      setBusy(false)
    }
  }

  const approve = async (requestId: string) => {
    const token = await getToken()
    if (!token) return alert('ログインしてください')

    setBusy(true)
    try {
      const res = await fetch('/api/rooms/approve-core', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id, requestId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return alert(json?.error ?? '承認に失敗しました')
      await reloadMyState()
    } finally {
      setBusy(false)
    }
  }

  const reject = async (requestId: string) => {
    const token = await getToken()
    if (!token) return alert('ログインしてください')

    setBusy(true)
    try {
      const res = await fetch('/api/rooms/reject-core', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id, requestId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return alert(json?.error ?? '却下に失敗しました')
      await reloadMyState()
    } finally {
      setBusy(false)
    }
  }

  // --- UI ---
  return (
    <div style={{ marginTop: 14 }}>
      {/* 操作ボックス */}
      <div
        style={{
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 14,
          padding: 14,
          background: '#fff',
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>参加・制作メニュー</div>

        <div style={{ fontSize: 13, color: '#555' }}>
          状態: <b>{room.status}</b>{' '}
          {myRole ? (
            <>
              / あなたのロール: <b>{myRole}</b>
            </>
          ) : (
            <> / 未参加</>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          {/* supporter参加 */}
          <button
            onClick={joinSupporter}
            disabled={busy || !isOpen || checking || !!myRole}
            style={{ padding: '10px 14px', borderRadius: 12, fontWeight: 900 }}
          >
            supporter参加
          </button>

          {/* core申請 */}
          {room.enable_core_approval && (
            <button
              onClick={requestCore}
              disabled={busy || !isOpen || checking || myRole === 'core' || myRole === 'creator'}
              style={{ padding: '10px 14px', borderRadius: 12, fontWeight: 900 }}
            >
              コア申請（承認制）
            </button>
          )}

          {/* 退出 */}
          <button
            onClick={leaveRoom}
            disabled={
              busy ||
              checking ||
              !myRole ||
              myRole === 'creator' ||
              (myRole === 'core' && !coreLeaveAllowed)
            }
            title={
              myRole === 'creator'
                ? 'creatorは退出できません'
                : myRole === 'core' && !coreLeaveAllowed
                ? 'coreは参加から5分以内のみ退出できます'
                : ''
            }
            style={{ padding: '10px 14px', borderRadius: 12, fontWeight: 900 }}
          >
            退出
          </button>
        </div>

        {/* core招待参加 */}
        {room.enable_core_invite && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>招待コードでcore参加</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="招待コード（8桁など）"
                style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.18)' }}
              />
              <button
                onClick={joinCoreByInvite}
                disabled={busy || !isOpen || checking}
                style={{ padding: '10px 14px', borderRadius: 12, fontWeight: 900 }}
              >
                core参加
              </button>
            </div>
          </div>
        )}

        {/* core退出の説明 */}
        {myRole === 'core' && !coreLeaveAllowed && (
          <div style={{ marginTop: 10, color: '#b00020', fontWeight: 800, fontSize: 13 }}>
            coreは参加から5分経過すると退出できません。
          </div>
        )}
      </div>

      {/* creator 承認UI */}
      {myRole === 'creator' && room.enable_core_approval && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            border: '1px solid rgba(0,0,0,0.12)',
            background: '#fafafa',
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>core申請（承認待ち）</div>

          {pendingRequests.length === 0 ? (
            <div style={{ color: '#666' }}>承認待ちはありません。</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {pendingRequests.map((r) => (
                <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: 12, border: '1px solid #eee' }}>
                  <div style={{ fontSize: 13, color: '#555' }}>
                    user_id: <b>{r.user_id}</b>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {new Date(r.created_at).toLocaleString()}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button disabled={busy} onClick={() => approve(r.id)} style={{ fontWeight: 900 }}>
                      承認
                    </button>
                    <button disabled={busy} onClick={() => reject(r.id)} style={{ fontWeight: 900 }}>
                      却下
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 掲示板：参加者のみ表示（既存「参加しないと投稿できない」をUIでも担保） */}
      {canPost ? (
        <div style={{ marginTop: 18 }}>
          <BoardClient roomId={room.id} roomStatus={room.status} />
        </div>
      ) : (
        <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: '#fff7e6', border: '1px solid #f3d08a' }}>
          参加すると掲示板に投稿できます。
        </div>
      )}
    </div>
  )
}
