'use client'

import { useEffect, useState } from 'react'

type JoinRequest = {
  id: string
  room_id: string
  user_id: string
  requested_role: string
  status: string
  message: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
  updated_at: string
}

export default function OwnerCoreRequestsPanel({ roomId }: { roomId: string }) {
  const [items, setItems] = useState<JoinRequest[]>([])
  const [err, setErr] = useState<string>('')

  const load = async () => {
    setErr('')
    const res = await fetch(`/api/rooms/${roomId}/core-requests`, { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok) {
      setErr(json.error ?? 'failed')
      setItems([])
      return
    }
    setItems(json.requests ?? [])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const act = async (path: string, requestId: string) => {
    setErr('')
    const res = await fetch(`/api/rooms/${roomId}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setErr(json.error ?? 'failed')
      return
    }
    await load()
  }

  if (err === 'Forbidden') return null // オーナー以外は出さない

  return (
    <section className="mt-6 rounded-lg border p-4">
      <h2 className="font-bold mb-2">オーナー専用：core申請一覧</h2>
      {err && <p className="text-red-600 text-sm">{err}</p>}

      {items.length === 0 ? (
        <p className="text-sm opacity-70">申請はありません</p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="rounded border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <div><b>user</b>: {r.user_id}</div>
                  <div><b>status</b>: {r.status}</div>
                  {r.message && <div><b>message</b>: {r.message}</div>}
                  <div className="opacity-60">created: {new Date(r.created_at).toLocaleString()}</div>
                </div>

                <div className="flex gap-2">
                  {r.status === 'pending' && (
                    <>
                      <button className="px-3 py-1 border rounded" onClick={() => act('core-approve', r.id)}>
                        承認
                      </button>
                      <button className="px-3 py-1 border rounded" onClick={() => act('core-reject', r.id)}>
                        却下
                      </button>
                    </>
                  )}
                  {r.status === 'approved' && (
                    <button className="px-3 py-1 border rounded" onClick={() => act('core-revoke', r.id)}>
                      取り消し
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
