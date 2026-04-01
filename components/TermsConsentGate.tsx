'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '@/lib/legalVersions'

type ProfileConsentRow = {
  id: string
  username: string | null
  terms_version: string | null
  terms_agreed_at: string | null
  privacy_version: string | null
  privacy_agreed_at: string | null
}

function buildFallbackUsername(user: {
  id: string
  email?: string | null
}) {
  const emailPrefix = (user.email ?? '').split('@')[0]?.trim()
  if (emailPrefix) {
    return `${emailPrefix}_${user.id.slice(0, 8)}`
  }
  return `user_${user.id.slice(0, 8)}`
}

function isAuthSessionMissingError(err: unknown) {
  const msg = String((err as any)?.message ?? '')
  return (
    msg.includes('Auth session missing') ||
    msg.includes('session missing') ||
    msg.includes('JWT') ||
    msg.includes('invalid claim: missing sub claim') ||
    msg.includes('session_not_found')
  )
}

function isAbortLikeError(err: unknown) {
  const name = String((err as any)?.name ?? '')
  const msg = String((err as any)?.message ?? '')
  return (
    name === 'AbortError' ||
    msg.includes('signal is aborted') ||
    msg.includes('aborted without reason') ||
    msg.includes('The operation was aborted')
  )
}

export default function TermsConsentGate() {
  const pathname = usePathname()

  const bypassPaths = ['/login', '/terms', '/privacy', '/auth/callback']
  const shouldBypass = useMemo(() => {
    return bypassPaths.includes(pathname)
  }, [pathname])

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [needsConsent, setNeedsConsent] = useState(false)
  const [error, setError] = useState('')

  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)

  const canSubmit = agreeTerms && agreePrivacy && !submitting

  useEffect(() => {
    let mounted = true

    const checkConsent = async () => {
      if (shouldBypass) {
        if (mounted) {
          setNeedsConsent(false)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setError('')

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) throw authError

        if (!user) {
          if (mounted) {
            setNeedsConsent(false)
            setLoading(false)
          }
          return
        }

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, terms_version, terms_agreed_at, privacy_version, privacy_agreed_at')
          .eq('id', user.id)
          .maybeSingle<ProfileConsentRow>()

        if (profileError) throw profileError

        const termsOk = data?.terms_version === CURRENT_TERMS_VERSION
        const privacyOk = data?.privacy_version === CURRENT_PRIVACY_VERSION

        if (mounted) {
          setNeedsConsent(!(termsOk && privacyOk))
          setLoading(false)
        }
      } catch (err: any) {
        if (!mounted) return

        if (isAbortLikeError(err)) {
          setError('')
          setNeedsConsent(false)
          setLoading(false)
          return
        }

        if (isAuthSessionMissingError(err)) {
          setError('')
          setNeedsConsent(false)
          setLoading(false)
          return
        }

        setError('利用規約の確認に一時的に失敗しました。ページを再読み込みしてください。')
        setNeedsConsent(false)
        setLoading(false)
      }
    }

    void checkConsent()

    return () => {
      mounted = false
    }
  }, [shouldBypass])

  const handleAgree = async () => {
    setError('')

    if (!agreeTerms || !agreePrivacy) {
      setError('利用規約とプライバシーポリシーの両方に同意してください。')
      return
    }

    setSubmitting(true)
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        if (isAuthSessionMissingError(authError)) {
          setError('ログイン後に再度お試しください。')
          return
        }
        throw authError
      }

      if (!user) {
        setError('ログイン後に再度お試しください。')
        return
      }

      const now = new Date().toISOString()

      const { data: existingProfile, error: selectError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', user.id)
        .maybeSingle<{ id: string; username: string | null }>()

      if (selectError) throw selectError

      if (existingProfile) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            terms_version: CURRENT_TERMS_VERSION,
            terms_agreed_at: now,
            privacy_version: CURRENT_PRIVACY_VERSION,
            privacy_agreed_at: now,
            updated_at: now,
          })
          .eq('id', user.id)

        if (updateError) throw updateError
      } else {
        const username = buildFallbackUsername({
          id: user.id,
          email: user.email,
        })

        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username,
            terms_version: CURRENT_TERMS_VERSION,
            terms_agreed_at: now,
            privacy_version: CURRENT_PRIVACY_VERSION,
            privacy_agreed_at: now,
            updated_at: now,
          })

        if (insertError) throw insertError
      }

      setNeedsConsent(false)
      setAgreeTerms(false)
      setAgreePrivacy(false)
    } catch (err: any) {
      if (isAuthSessionMissingError(err)) {
        setError('ログイン後に再度お試しください。')
        return
      }
      setError(err?.message ?? '再同意の保存に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null
  if (!needsConsent) return null

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-labelledby="terms-consent-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: 'min(92dvh, 760px)',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 20px 14px',
            borderBottom: '1px solid #eee',
            flexShrink: 0,
          }}
        >
          <h2 id="terms-consent-title" style={{ marginTop: 0, marginBottom: 12 }}>
            利用規約・プライバシーポリシーの再同意
          </h2>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            WebkitOverflowScrolling: 'touch',
            lineHeight: 1.8,
            color: '#333',
          }}
        >
          <p style={{ marginTop: 0 }}>
            利用規約およびプライバシーポリシーが更新されました。
            引き続き本サービスを利用するには、最新の内容への同意が必要です。
          </p>

          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: '#fafafa',
              border: '1px solid #eee',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>今回の重要な内容</div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>共同制作物の権利と外部利用制限</li>
              <li>AI利用作品の取扱い</li>
              <li>二次創作・既存IP利用に関するルール</li>
              <li>強制公開（forced_publish）などの重要仕様</li>
              <li>個人情報・利用者情報の取扱い</li>
            </ul>
          </div>

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                style={{ marginTop: 4, flexShrink: 0 }}
              />
              <span>
                <Link href="/terms" target="_blank">
                  利用規約
                </Link>
                を確認し、同意します。
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                style={{ marginTop: 4, flexShrink: 0 }}
              />
              <span>
                <Link href="/terms?tab=privacy" target="_blank">
                  プライバシーポリシー
                </Link>
                を確認し、同意します。
              </span>
            </label>
          </div>

          <div style={{ fontSize: 12, color: '#666', marginTop: 12, lineHeight: 1.7 }}>
            ※ 同意しない場合、投稿、ルーム参加、その他主要機能は利用できません。
          </div>

          {error ? (
            <div
              style={{
                marginTop: 14,
                padding: 10,
                borderRadius: 10,
                background: 'rgba(255,0,0,0.08)',
                color: '#b00020',
                whiteSpace: 'pre-wrap',
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div
          style={{
            padding: '16px 20px calc(16px + env(safe-area-inset-bottom))',
            borderTop: '1px solid #eee',
            background: '#fff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleAgree}
              disabled={!canSubmit}
              style={{
                minWidth: 180,
                minHeight: 44,
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid #111',
                background: '#111',
                color: '#fff',
                opacity: canSubmit ? 1 : 0.6,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontWeight: 800,
              }}
            >
              {submitting ? '保存中…' : '同意して続ける'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}