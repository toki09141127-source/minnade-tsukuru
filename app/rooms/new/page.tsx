'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

type WorkType = 'novel' | 'manga' | 'anime'
type PageFormat = '8p' | '16p' | '32p' | '4koma'

export default function NewRoomPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [workType, setWorkType] = useState<WorkType>('novel')
  const [pageFormat, setPageFormat] = useState<PageFormat>('8p')
  const [timeLimitHours, setTimeLimitHours] = useState(50)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // 表示用のデフォルト時間
  const initialHours = useMemo(() => {
    if (workType === 'novel') return 50
    if (workType === 'manga') return 100
    return 150
  }, [workType])

  const onChangeWorkType = (v: WorkType) => {
    setWorkType(v)
    if (v === 'novel') setTimeLimitHours(50)
    else if (v === 'manga') setTimeLimitHours(100)
    else setTimeLimitHours(150)
  }

  const createRoom = async () => {
    if (busy) return
    setBusy(true)
    setMessage('処理開始…')

    try {
      if (!title.trim()) {
        setMessage('タイトルを入れてください')
        return
      }

      setMessage('ログイン確認中…')
      const { data: userData, error: userErr } = await supabase.auth.getUser()

      if (userErr) {
        setMessage('getUser エラー: ' + userErr.message)
        return
      }
      if (!userData.user) {
        setMessage('未ログインです。/login に移動します')
        router.push('/login')
        return
      }

      const userId = userData.user.id

      // ✅ 期限を正しく計算（今から timeLimitHours 後）
      const expiresAt = new Date(Date.now() + timeLimitHours * 60 * 60 * 1000)

      setMessage('DBに保存中…')

      // ✅ host_ids NOT NULL 対策：必ず入れる（あなたのDBが必須でも通る）
      // ✅ page_format は漫画以外は null
      const payload: any = {
        title: title.trim(),
        work_type: workType,
        page_format: workType === 'manga' ? pageFormat : null,
        time_limit_hours: timeLimitHours,
        status: 'open',
        created_by: userId,
        expires_at: expiresAt.toISOString(),
        host_ids: [userId],
      }

      const { data, error } = await supabase
        .from('rooms')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        setMessage('insert エラー: ' + error.message)
        return
      }

      setMessage('保存完了！詳細へ移動します')

      const newId = data?.id
      if (!newId) {
        setMessage('作成は成功しましたが、id取得に失敗しました。/rooms に戻ります')
        router.replace('/rooms')
        router.refresh()
        return
      }

      router.replace(`/rooms/${newId}`)
      router.refresh()
    } catch (e: any) {
      setMessage('例外エラー: ' + (e?.message ?? String(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>制作ルームを作る</h1>

      <div
        style={{
          marginTop: 12,
          padding: 14,
          background: '#eef3ff',
          borderRadius: 10,
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        <strong>はじめての人へ</strong>
        <br />
        ルームを作ると、制限時間（expires_at）が自動で設定されます。
        <br />
        制限時間を過ぎると自動で forced_publish になります。
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontWeight: 700 }}>タイトル</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例）50人で50時間ノベル"
          style={{
            display: 'block',
            width: '100%',
            border: '1px solid #ccc',
            padding: 10,
            marginTop: 8,
            borderRadius: 8,
          }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontWeight: 700 }}>形式</label>
        <select
          value={workType}
          onChange={(e) => onChangeWorkType(e.target.value as WorkType)}
          style={{
            display: 'block',
            border: '1px solid #ccc',
            padding: 10,
            marginTop: 8,
            borderRadius: 8,
            width: 220,
          }}
        >
          <option value="novel">小説</option>
          <option value="manga">漫画</option>
          <option value="anime">アニメ</option>
        </select>

        <p style={{ marginTop: 8, color: '#666' }}>
          デフォルト：小説 50h / 漫画 100h / アニメ 150h（変更OK）
          <br />
          （いまのデフォルト: {initialHours}h）
        </p>
      </div>

      {workType === 'manga' && (
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontWeight: 700 }}>ページ形式（漫画）</label>
          <select
            value={pageFormat}
            onChange={(e) => setPageFormat(e.target.value as PageFormat)}
            style={{
              display: 'block',
              border: '1px solid #ccc',
              padding: 10,
              marginTop: 8,
              borderRadius: 8,
              width: 220,
            }}
          >
            <option value="8p">8ページ</option>
            <option value="16p">16ページ</option>
            <option value="32p">32ページ</option>
            <option value="4koma">四コマ</option>
          </select>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontWeight: 700 }}>制限時間（時間）</label>
        <input
          type="number"
          value={timeLimitHours}
          onChange={(e) => setTimeLimitHours(Number(e.target.value))}
          min={1}
          style={{
            display: 'block',
            border: '1px solid #ccc',
            padding: 10,
            marginTop: 8,
            borderRadius: 8,
            width: 140,
          }}
        />
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={createRoom}
          disabled={busy}
          style={{
            padding: '10px 14px',
            border: '1px solid #111',
            borderRadius: 8,
            cursor: busy ? 'not-allowed' : 'pointer',
            background: '#111',
            color: '#fff',
            opacity: busy ? 0.6 : 1,
          }}
        >
          作成
        </button>

        <button
          type="button"
          onClick={() => router.push('/rooms')}
          style={{
            padding: '10px 14px',
            border: '1px solid #111',
            borderRadius: 8,
            cursor: 'pointer',
            background: '#fff',
            color: '#111',
          }}
        >
          一覧に戻る
        </button>
      </div>

      {message && (
        <p style={{ marginTop: 14, color: '#b00020', whiteSpace: 'pre-wrap' }}>
          {message}
        </p>
      )}
    </div>
  )
}
