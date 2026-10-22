'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import BoardClient from './BoardClient'
import MemberManagement from './MemberManagement'
import WorkDraftEditor from './WorkDraftEditor'
import ConfirmModal from '@/app/components/ConfirmModal'
import RoomConsentModal, { type ConsentPayload } from '@/components/RoomConsentModal'

type RoomFlags = {
  draftsEnabled?: boolean
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

type PendingAction =
  | null
  | 'joinSupporter'
  | 'requestCore'

export default function RoomDetailClient({ room }: { room: RoomFlags }) {
  const [myMember, setMyMember] = useState<MyMember>(null)
  const [checking, setChecking] = useState(true)

  const [pendingRequests, setPendingRequests] = useState<JoinRequestRow[]>([])
  const [busy, setBusy] = useState(false)

  const [uiError, setUiError] = useState<string>('')
  const [uiNotice, setUiNotice] = useState<string>('')

  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const isOpen = room.status === 'open'

  const myRole = myMember?.left_at == null ? myMember?.role : null


  const [now,setNow] = useState(() => Date.now())
  useEffect(() => {
    if (myRole !== 'core') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [myRole])
  const joinedAt = myMember?.joined_at ? new Date(myMember.joined_at).getTime() : NaN
  const coreLeaveAllowed = myRole === 'core' && Number.isFinite(joinedAt) &&
    now >= joinedAt && now - joinedAt <= 5 * 60 * 1000

  const canPost = isOpen && (myRole === 'supporter' || myRole === 'core' || myRole === 'creator')


  const [leaveOpen, setLeaveOpen] = useState(false)

  const getToken = async () => {
    const sess = await supabase.auth.getSession()
    return sess.data.session?.access_token ?? null
  }

  const reloadMyState = async () => {
    setChecking(true)

    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id ?? null

    if (!uid) {
      setMyMember(null)
      setPendingRequests([])
      setChecking(false)
      return
    }

    const { data: mem } = await supabase
      .from('room_members')
      .select('role, joined_at, left_at')
      .eq('room_id', room.id)
      .eq('user_id', uid)
      .maybeSingle()

    setMyMember((mem as MyMember) ?? null)

    if (mem?.left_at == null && mem?.role === 'creator') {
      const { data: reqs } = await supabase
        .from('room_join_requests')
        .select('id, user_id, created_at')
        .eq('room_id', room.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      setPendingRequests((reqs ?? []) as JoinRequestRow[])
    } else {
      setPendingRequests([])
    }

    setChecking(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize session/DB state; checking tracks the async request lifecycle.
    reloadMyState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id])

  const joinSupporter = async (consent: ConsentPayload) => {
    setUiError('')
    setUiNotice('')
    if (!isOpen) return setUiError('このルームは参加できません')
    const token = await getToken()
    if (!token) return setUiError('ログインしてください')

    setBusy(true)
    try {
      const res = await fetch('/api/rooms/join-supporter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id, consent }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return setUiError(json?.error ?? '参加に失敗しました')
      setPendingAction(null)
      await reloadMyState()
    } finally {
      setBusy(false)
    }
  }

  const requestCore = async (consent: ConsentPayload) => {
    setUiError('')
    setUiNotice('')
    if (!isOpen) return setUiError('このルームは申請できません')
    if (!room.enable_core_approval) return
    const token = await getToken()
    if (!token) return setUiError('ログインしてください')

    setBusy(true)
    try {
      const res = await fetch('/api/rooms/request-core', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id, consent }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return setUiError(json?.error ?? '申請に失敗しました')
      setPendingAction(null)
      setUiNotice('core申請を送信しました')
      await reloadMyState()
    } finally {
      setBusy(false)
    }
  }

  const executeLeaveRoom = async () => {
    setUiError('')
    setUiNotice('')
    const token = await getToken()
    if (!token) {
      setUiError('ログインしてください')
      setLeaveOpen(false)
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return setUiError(json?.error ?? '退出に失敗しました')
      await reloadMyState()
    } finally {
      setBusy(false)
      setLeaveOpen(false)
    }
  }

  const approve = async (requestId: string) => {
    setUiError('')
    setUiNotice('')
    const token = await getToken()
    if (!token) return setUiError('ログインしてください')

    setBusy(true)
    try {
      const res = await fetch('/api/rooms/approve-core', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id, requestId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return setUiError(json?.error ?? '承認に失敗しました')
      setUiNotice('承認しました')
      await reloadMyState()
    } finally {
      setBusy(false)
    }
  }

  const reject = async (requestId: string) => {
    setUiError('')
    setUiNotice('')
    const token = await getToken()
    if (!token) return setUiError('ログインしてください')

    setBusy(true)
    try {
      const res = await fetch('/api/rooms/reject-core', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id, requestId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return setUiError(json?.error ?? '却下に失敗しました')
      setUiNotice('却下しました')
      await reloadMyState()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      {myRole === 'creator' && isOpen && <MemberManagement roomId={room.id} />}
      {(myRole === 'creator' || myRole === 'core') && <WorkDraftEditor roomId={room.id} />}
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
              / あなたのロール: <b>{myRole === 'supporter' ? 'メンバー' : myRole === 'core' ? 'Core' : 'Creator'}</b>
            </>
          ) : (
            <> / 未参加</>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          <button
            onClick={() => {
              setUiError('')
              setUiNotice('')
              setPendingAction('joinSupporter')
            }}
            disabled={busy || !isOpen || checking || !!myRole}
            style={{ padding: '10px 14px', borderRadius: 12, fontWeight: 900 }}
          >
            メンバー参加
          </button>

          {room.enable_core_approval && (
            <button
              onClick={() => {
                setUiError('')
                setUiNotice('')
                setPendingAction('requestCore')
              }}
              disabled={busy || !isOpen || checking || myRole !== 'supporter'}
              style={{ padding: '10px 14px', borderRadius: 12, fontWeight: 900 }}
            >
              コア申請（承認制）
            </button>
          )}

          <button
            onClick={() => {
              setUiError('')
              setUiNotice('')
              setLeaveOpen(true)
            }}
            disabled={busy || checking || !myRole || myRole === 'creator' || (myRole === 'core' && !coreLeaveAllowed)}
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

        {myRole === 'core' && !coreLeaveAllowed && (
          <div style={{ marginTop: 10, color: '#b00020', fontWeight: 800, fontSize: 13 }}>
            coreは参加から5分経過すると退出できません。
          </div>
        )}

        {!!uiError && (
          <div style={{ marginTop: 10, color: '#b00020', fontWeight: 800, fontSize: 13 }}>
            {uiError}
          </div>
        )}

        {!!uiNotice && (
          <div style={{ marginTop: 10, color: '#0a7', fontWeight: 800, fontSize: 13 }}>
            {uiNotice}
          </div>
        )}
      </div>

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
                <div
                  key={r.id}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: 12,
                    border: '1px solid #eee',
                  }}
                >
                  <div style={{ fontSize: 13, color: '#555' }}>
                    user_id: <b>{r.user_id}</b>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{new Date(r.created_at).toLocaleString()}</div>

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

      {canPost ? (
        <div style={{ marginTop: 18 }}>
          <BoardClient roomId={room.id} roomStatus={room.status} myRole={myRole} draftsEnabled={room.draftsEnabled} />
        </div>
      ) : (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            background: '#fff7e6',
            border: '1px solid #f3d08a',
          }}
        >
          参加すると掲示板に投稿できます。
        </div>
      )}

      <ConfirmModal
        open={leaveOpen}
        title="このルームから退出しますか？"
        description={
          myRole === 'core'
            ? 'coreは参加から5分以内のみ退出できます。条件を満たしていれば退出できます。'
            : '退出すると、このルームで投稿や取り消しができなくなります。'
        }
        confirmText="退出する"
        cancelText="キャンセル"
        danger
        loading={busy}
        onCancel={() => !busy && setLeaveOpen(false)}
        onConfirm={executeLeaveRoom}
      />

      <RoomConsentModal
        open={pendingAction === 'joinSupporter'}
        title="メンバー参加前の確認"
        description="メンバーとして参加する前に、共同制作と強制公開に関する内容を確認してください。"
        requireCoreLock={false}
        loading={busy}
        error={uiError}
        onClose={() => !busy && setPendingAction(null)}
        onConfirm={joinSupporter}
      />

      <RoomConsentModal
        open={pendingAction === 'requestCore'}
        title="core申請前の確認"
        description="承認制のcore申請を送る前に、共同制作、強制公開、およびcore退出制限に関する内容を確認してください。"
        requireCoreLock={true}
        loading={busy}
        error={uiError}
        onClose={() => !busy && setPendingAction(null)}
        onConfirm={requestCore}
      />

    </div>
  )
}
