'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '@/lib/legalVersions'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const [signupSuccess, setSignupSuccess] = useState(false)
  const [resending, setResending] = useState(false)

  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)

  const [loading, setLoading] = useState(false)

  const eTrim = useMemo(() => email.trim(), [email])

  const normalizePassword = (p: string) => {
    return p.replace(/^\s+|\s+$/g, '')
  }

  const setFriendlyError = (raw: string) => {
    if (raw.includes('Invalid login credentials')) {
      setMessage(
        [
          'メールアドレス or パスワードが違います。',
          '・コピペ末尾の空白 / CapsLock / 自動入力の別パスワードに注意',
          '・不明な場合は「パスワード再設定」をお試しください',
        ].join('\n')
      )
      return
    }

    if (raw.toLowerCase().includes('email not confirmed')) {
      setMessage(
        [
          'メール認証が完了していません。',
          '確認メールのリンクをクリックして有効化してからログインしてください。',
          '届かない場合は「確認メールを再送する」を押してください。',
        ].join('\n')
      )
      return
    }

    setMessage(raw)
  }

  const signUp = async () => {
    setMessage('')
    setSignupSuccess(false)

    const e = eTrim
    const p = normalizePassword(password)

    if (!e) {
      setMessage('メールアドレスを入力してください')
      return
    }
    if (p.length < 6) {
      setMessage('パスワードは6文字以上にしてください')
      return
    }
    if (!agreeTerms || !agreePrivacy) {
      setMessage('新規登録には、利用規約とプライバシーポリシーへの同意が必要です。')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: e,
        password: p,
      })

      if (error) {
        setFriendlyError(error.message)
        return
      }

      const userId = data.user?.id

      if (userId) {
        const now = new Date().toISOString()

        const { error: upsertError } = await supabase.from('profiles').upsert(
          {
            id: userId,
            terms_version: CURRENT_TERMS_VERSION,
            terms_agreed_at: now,
            privacy_version: CURRENT_PRIVACY_VERSION,
            privacy_agreed_at: now,
            updated_at: now,
          },
          { onConflict: 'id' }
        )

        if (upsertError) {
          setMessage(
            [
              'アカウント登録自体は成功しましたが、同意記録の保存に失敗しました。',
              '管理者にお問い合わせください。',
              `詳細: ${upsertError.message}`,
            ].join('\n')
          )
          return
        }
      }

      setSignupSuccess(true)
      setMessage('')
    } finally {
      setLoading(false)
    }
  }

  const signIn = async () => {
    setMessage('')

    const e = eTrim
    const p = normalizePassword(password)

    if (!e) {
      setMessage('メールアドレスを入力してください')
      return
    }
    if (!p) {
      setMessage('パスワードを入力してください')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: e, password: p })
      if (error) {
        setFriendlyError(error.message)
        return
      }
      router.replace('/')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const sendPasswordReset = async () => {
    setMessage('')

    const e = eTrim
    if (!e) {
      setMessage('メールアドレスを入力してください（再設定メールの送信に必要です）')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined,
      })
      if (error) {
        setFriendlyError(error.message)
        return
      }
      setMessage('パスワード再設定メールを送信しました ✅（迷惑メールもご確認ください）')
    } finally {
      setLoading(false)
    }
  }

  const resendConfirmation = async () => {
    setMessage('')

    const e = eTrim
    if (!e) {
      setMessage('メールアドレスを入力してください（確認メール再送に必要です）')
      return
    }

    setResending(true)
    try {
      const authAny = supabase.auth as any

      if (typeof authAny?.resend === 'function') {
        const { error } = await authAny.resend({ type: 'signup', email: e })
        if (error) {
          setFriendlyError(error.message)
          return
        }
        setMessage('確認メールを再送しました ✅（迷惑メールもご確認ください）')
        return
      }

      setMessage(
        'この環境では確認メール再送APIが利用できません（supabase-jsのバージョン確認が必要です）'
      )
    } finally {
      setResending(false)
    }
  }

  const isSuccessMsg =
    message.includes('✅') ||
    message.includes('再送しました') ||
    message.includes('送信しました')

  return (
    <div style={{ padding: 24 }}>
      <h1>ログイン</h1>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: '1px solid #eee',
          borderRadius: 10,
          background: '#fafafa',
          maxWidth: 720,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>手順（メール＋パスワード方式）</div>

        <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7, marginBottom: 8 }}>
          このサイトは<strong>「メール＋パスワード」</strong>でログインします。
          <br />
          <strong>マジックリンク方式ではありません。</strong>
        </div>

        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.75 }}>
          <li>
            <strong>初めての人</strong>は、メールアドレスとパスワードを入力し、
            利用規約・プライバシーポリシーに同意のうえ「<strong>新規登録</strong>」を押す
          </li>

          <li>
            新規登録後、確認メールが届いたら<strong>メール内リンクをクリックして有効化</strong>する
            <div style={{ fontSize: 12, color: '#666', marginTop: 6, lineHeight: 1.6 }}>
              ※迷惑メールフォルダもご確認ください。<br />
              ※リンクを押しただけでは、この画面で自動的にログインされない場合があります（仕様です）。
            </div>
          </li>

          <li>
            <strong>有効化後</strong>にこの画面に戻り、「<strong>ログイン</strong>」を押す
          </li>

          <li>
            <strong>登録済みの人</strong>は、メールアドレスとパスワードを入力して「<strong>ログイン</strong>」だけでOK
          </li>
        </ol>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (signupSuccess) setSignupSuccess(false)
          }}
          style={{
            border: '1px solid #ccc',
            padding: 8,
            minWidth: 220,
            flex: '1 1 220px',
          }}
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (signupSuccess) setSignupSuccess(false)
          }}
          style={{
            border: '1px solid #ccc',
            padding: 8,
            minWidth: 220,
            flex: '1 1 220px',
          }}
        />
      </div>

      <div
        style={{
          marginTop: 14,
          maxWidth: 720,
          padding: 12,
          border: '1px solid #eee',
          borderRadius: 10,
          background: '#fafafa',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>新規登録時の同意</div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span style={{ lineHeight: 1.7 }}>
            <Link href="/terms" target="_blank">
              利用規約
            </Link>
            に同意します
          </span>
        </label>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <input
            type="checkbox"
            checked={agreePrivacy}
            onChange={(e) => setAgreePrivacy(e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span style={{ lineHeight: 1.7 }}>
            <Link href="/privacy" target="_blank">
              プライバシーポリシー
            </Link>
            に同意します
          </span>
        </label>

        <div style={{ fontSize: 12, color: '#666', marginTop: 10, lineHeight: 1.6 }}>
          ※ この同意は新規登録時に必要です。ログインだけならチェック不要です。
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={signUp} style={{ minWidth: 120 }} disabled={loading}>
          {loading ? '処理中…' : '新規登録'}
        </button>
        <button onClick={signIn} style={{ minWidth: 120 }} disabled={loading}>
          {loading ? '処理中…' : 'ログイン'}
        </button>
        <button onClick={sendPasswordReset} style={{ minWidth: 160 }} disabled={loading}>
          {loading ? '送信中…' : 'パスワード再設定'}
        </button>
      </div>

      {signupSuccess && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid #eee',
            borderRadius: 10,
            background: '#fafafa',
            maxWidth: 720,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>確認メールを送信しました</div>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            ・迷惑メールフォルダも確認してください
            <br />
            ・メール内リンクをクリックして<strong>有効化</strong>してください
            <br />
            ・有効化後にこの画面に戻り、<strong>ログイン</strong>してください
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={resendConfirmation} disabled={resending} style={{ minWidth: 160 }}>
              {resending ? '送信中…' : '確認メールを再送する'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            marginTop: 12,
            padding: 10,
            border: '1px solid #ddd',
            borderRadius: 10,
            background: '#fff',
            color: isSuccessMsg ? '#0a7' : '#b00020',
            maxWidth: 720,
          }}
        >
          {message}
        </pre>
      )}
    </div>
  )
}