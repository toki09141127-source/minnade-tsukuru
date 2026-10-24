'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import LegalLinks from '@/components/LegalLinks'
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
  adult_confirmed_at: string | null
}

function errorField(err: unknown, key: 'message' | 'name') {
  return typeof err === 'object' && err !== null && key in err ? String((err as Record<string, unknown>)[key]) : ''
}

function isAuthSessionMissingError(err: unknown) {
  const msg = errorField(err, 'message')
  return (
    msg.includes('Auth session missing') ||
    msg.includes('session missing') ||
    msg.includes('JWT') ||
    msg.includes('invalid claim: missing sub claim') ||
    msg.includes('session_not_found')
  )
}

function isAbortLikeError(err: unknown) {
  const name = errorField(err, 'name')
  const msg = errorField(err, 'message')
  return (
    name === 'AbortError' ||
    msg.includes('signal is aborted') ||
    msg.includes('aborted without reason') ||
    msg.includes('The operation was aborted')
  )
}

export default function TermsConsentGate() {
  const pathname = usePathname()

  const bypassPaths = ['/login', '/terms', '/privacy', '/auth/callback', '/auth/reset-password', '/guidelines']
  const shouldBypass = bypassPaths.includes(pathname)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [needsConsent, setNeedsConsent] = useState(false)
  const [error, setError] = useState('')

  const [adultConfirmed, setAdultConfirmed] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)

  const canSubmit = adultConfirmed && agreeTerms && agreePrivacy && !submitting

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
          .select('id, username, terms_version, terms_agreed_at, privacy_version, privacy_agreed_at, adult_confirmed_at')
          .eq('id', user.id)
          .maybeSingle<ProfileConsentRow>()

        if (profileError) throw profileError

        const termsOk = data?.terms_version === CURRENT_TERMS_VERSION
        const privacyOk = data?.privacy_version === CURRENT_PRIVACY_VERSION

        if (mounted) {
          setNeedsConsent(!(termsOk && privacyOk && data?.adult_confirmed_at))
          setLoading(false)
        }
      } catch (err: unknown) {
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

    if (!adultConfirmed || !agreeTerms || !agreePrivacy) {
      setError('18歳以上の確認と、利用規約・プライバシーポリシーへの同意が必要です。')
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

      const { error: consentError } = await supabase.rpc('mvp_accept_current_terms', {
        p_terms: CURRENT_TERMS_VERSION,
        p_privacy: CURRENT_PRIVACY_VERSION,
        p_adult: adultConfirmed,
      })
      if (consentError) throw consentError

      setNeedsConsent(false)
      setAdultConfirmed(false)
      setAgreeTerms(false)
      setAgreePrivacy(false)
    } catch (err: unknown) {
      if (isAuthSessionMissingError(err)) {
        setError('ログイン後に再度お試しください。')
        return
      }
      setError('再同意の保存に失敗しました。時間をおいてお試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null
  if (!needsConsent && error) return <div role="alert" style={{ padding: 16, background: '#fff3cd', color: '#543b00' }}>{error}</div>
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
              <li>初期MVPは18歳以上の方が対象です</li>
              <li>共同制作物の権利と外部利用制限</li>
              <li>無料V2の初回公開ではAI生成と有料契約を停止します</li>
              <li>二次創作・既存IP利用に関するルール</li>
              <li>強制公開（forced_publish）などの重要仕様</li>
              <li>退会後も共同作品・使用済み添付を保持し、通常の公開名義を匿名化します</li>
              <li>本文に記載した個人情報の申立ては個別に確認します</li>
              <li>通報・監査・バックアップの保持は、運営者が定期的に必要性を確認します</li>
            </ul>
          </div>

          <LegalLinks />
          <label style={{display:"flex",gap:8,marginTop:14}}><input type="checkbox" checked={adultConfirmed} onChange={e=>setAdultConfirmed(e.target.checked)} />私は18歳以上です</label>
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
