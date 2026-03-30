'use client'

import { useEffect, useState } from 'react'
import { CURRENT_ROOM_TERMS_VERSION } from '@/lib/legalVersions'

export type ConsentPayload = {
  roomTermsVersion: string
  roomAgreedAt: string
  forcedPublishAckAt: string
  coreLockAgreedAt?: string
}

type Props = {
  open: boolean
  title: string
  description: string
  requireCoreLock: boolean
  loading: boolean
  error: string
  onClose: () => void
  onConfirm: (consent: ConsentPayload) => void
}

export default function RoomConsentModal({
  open,
  title,
  description,
  requireCoreLock,
  loading,
  error,
  onClose,
  onConfirm,
}: Props) {
  const [agreeRoom, setAgreeRoom] = useState(false)
  const [agreeForcedPublish, setAgreeForcedPublish] = useState(false)
  const [agreeCoreLock, setAgreeCoreLock] = useState(false)

  useEffect(() => {
    if (!open) {
      setAgreeRoom(false)
      setAgreeForcedPublish(false)
      setAgreeCoreLock(false)
    }
  }, [open])

  if (!open) return null

  const canConfirm =
    agreeRoom && agreeForcedPublish && (!requireCoreLock || agreeCoreLock) && !loading

  return (
    <div
      aria-modal="true"
      role="dialog"
      onClick={() => !loading && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: 'min(92dvh, 760px)',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 20px 14px',
            borderBottom: '1px solid #eee',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0 }}>{title}</h2>
          <p style={{ margin: '10px 0 0', lineHeight: 1.8 }}>{description}</p>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            style={{
              padding: 12,
              border: '1px solid #eee',
              borderRadius: 12,
              background: '#fafafa',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              ルーム参加に関する確認
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>あなたの投稿は他の参加者に閲覧・引用・編集・組込みされる場合があります</li>
              <li>投稿内容は完成作品として公開される場合があります</li>
              <li>作品制作上、投稿が要約・トリミング・形式変更される場合があります</li>
              <li>成果物の外部利用は原則禁止です</li>
            </ul>
          </div>

          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: '1px solid #eee',
              borderRadius: 12,
              background: '#fafafa',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>強制公開について</div>
            <div style={{ lineHeight: 1.8 }}>
              制限時間が終了すると、成果物は自動的に公開状態へ移行する場合があります（forced_publish）。
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={agreeRoom}
                onChange={(e) => setAgreeRoom(e.target.checked)}
                style={{ marginTop: 4, flexShrink: 0 }}
              />
              <span style={{ lineHeight: 1.7 }}>
                共同制作に伴う投稿の編集・組込み・公開範囲について理解し、利用規約に同意します。
              </span>
            </label>

            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={agreeForcedPublish}
                onChange={(e) => setAgreeForcedPublish(e.target.checked)}
                style={{ marginTop: 4, flexShrink: 0 }}
              />
              <span style={{ lineHeight: 1.7 }}>
                制限時間終了時に成果物が自動公開される可能性があることを理解し、同意します。
              </span>
            </label>

            {requireCoreLock && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={agreeCoreLock}
                  onChange={(e) => setAgreeCoreLock(e.target.checked)}
                  style={{ marginTop: 4, flexShrink: 0 }}
                />
                <span style={{ lineHeight: 1.7 }}>
                  core は参加から5分経過後、原則として退出できないことを理解し、同意します。
                </span>
              </label>
            )}
          </div>

          {!!error && (
            <div style={{ marginTop: 10, color: '#b00020', fontWeight: 800, fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 'auto',
            padding: '14px 20px calc(14px + env(safe-area-inset-bottom))',
            borderTop: '1px solid #eee',
            background: '#fff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const now = new Date().toISOString()
                const consent: ConsentPayload = {
                  roomTermsVersion: CURRENT_ROOM_TERMS_VERSION,
                  roomAgreedAt: now,
                  forcedPublishAckAt: now,
                  ...(requireCoreLock ? { coreLockAgreedAt: now } : {}),
                }
                onConfirm(consent)
              }}
              disabled={!canConfirm}
              style={{
                minWidth: 160,
                minHeight: 44,
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid #111',
                background: '#111',
                color: '#fff',
                opacity: canConfirm ? 1 : 0.6,
                cursor: canConfirm ? 'pointer' : 'not-allowed',
                fontWeight: 900,
              }}
            >
              {loading ? '処理中…' : '同意して進む'}
            </button>

            <button
              onClick={onClose}
              disabled={loading}
              style={{
                minHeight: 44,
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid #ccc',
                background: '#fff',
                color: '#111',
                fontWeight: 700,
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}