'use client'

import React from 'react'

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = 'OK',
  cancelText = 'キャンセル',
  danger = false,
  loading = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  const smallButtonStyle: React.CSSProperties = {
    background: '#fff',
    color: '#111',
    border: '1px solid rgba(0,0,0,0.20)',
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 900,
    cursor: 'pointer',
  }

  const confirmStyle: React.CSSProperties = danger
    ? {
        ...smallButtonStyle,
        background: '#b00020',
        color: '#fff',
        borderColor: '#b00020',
        opacity: loading ? 0.7 : 1,
      }
    : {
        ...smallButtonStyle,
        background: '#111',
        color: '#fff',
        borderColor: '#111',
        opacity: loading ? 0.7 : 1,
      }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => !loading && onCancel()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 14,
          padding: 14,
          border: '1px solid rgba(0,0,0,0.10)',
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>

        {description && (
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.82, lineHeight: 1.6 }}>{description}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
          <button disabled={loading} onClick={onCancel} style={smallButtonStyle}>
            {cancelText}
          </button>

          <button disabled={loading} onClick={onConfirm} style={confirmStyle}>
            {loading ? '処理中…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}