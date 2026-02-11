'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase/client'
import DeleteAccountButton from './DeleteAccountButton'
import { isValidHttpUrlOrEmpty, normalizeHttpUrlOrEmpty } from './../../lib/validators/url'

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('') // 空なら変更しない
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')

  // ✅ SNS links (追加)
  const [xUrl, setXUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: u } = await supabase.auth.getUser()
      setEmail(u.user?.email ?? null)

      if (u.user?.id) {
        // ✅ selectにSNSカラムを追加（読み込み）
        const { data: prof } = await supabase
          .from('profiles')
          .select('username, x_url, youtube_url, instagram_url, tiktok_url, website_url')
          .eq('id', u.user.id)
          .maybeSingle()

        setUsername((prof?.username ?? '').toString())

        setXUrl((prof?.x_url ?? '').toString())
        setYoutubeUrl((prof?.youtube_url ?? '').toString())
        setInstagramUrl((prof?.instagram_url ?? '').toString())
        setTiktokUrl((prof?.tiktok_url ?? '').toString())
        setWebsiteUrl((prof?.website_url ?? '').toString())
      }
    }
    init()
  }, [])

  const canSave = useMemo(() => {
    if (loading) return false

    const nameOk = username.trim().length >= 2 && username.trim().length <= 20
    const passOk = password === '' || password.length >= 6

    // ✅ URLバリデーション（空ならOK / 入ってるならhttp(s)）
    const urlsOk =
      isValidHttpUrlOrEmpty(xUrl) &&
      isValidHttpUrlOrEmpty(youtubeUrl) &&
      isValidHttpUrlOrEmpty(instagramUrl) &&
      isValidHttpUrlOrEmpty(tiktokUrl) &&
      isValidHttpUrlOrEmpty(websiteUrl)

    return nameOk && passOk && urlsOk
  }, [username, password, loading, xUrl, youtubeUrl, instagramUrl, tiktokUrl, websiteUrl])

  const save = async () => {
    setMsg('')
    const name = username.trim()

    if (name.length < 2 || name.length > 20) {
      setMsg('ユーザー名は 2〜20文字 にしてください')
      return
    }
    if (password !== '' && password.length < 6) {
      setMsg('パスワードは 6文字以上 にしてください（変更しないなら空でOK）')
      return
    }

    // ✅ SNS URL validation（保存前に明示的チェック）
    const snsPayload = {
      x_url: normalizeHttpUrlOrEmpty(xUrl),
      youtube_url: normalizeHttpUrlOrEmpty(youtubeUrl),
      instagram_url: normalizeHttpUrlOrEmpty(instagramUrl),
      tiktok_url: normalizeHttpUrlOrEmpty(tiktokUrl),
      website_url: normalizeHttpUrlOrEmpty(websiteUrl),
    }

    for (const [k, v] of Object.entries(snsPayload)) {
      if (!isValidHttpUrlOrEmpty(v)) {
        setMsg(`URLが不正です: ${k} は http:// または https:// から始めてください（空はOK）`)
        return
      }
    }

    setLoading(true)
    try {
      // ログイン必須
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) {
        setMsg('ログインしてください')
        return
      }

      // ① ユーザー名更新（既存）
      const res = await fetch('/profile/set-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: name }),
      })
      const json = await res.json()
      if (!json.ok) {
        setMsg(json.error ?? 'ユーザー名の保存に失敗しました')
        return
      }

      // ② SNSリンク更新（追加：サーバRoute Handler経由）
      const res2 = await fetch('/profile/set-sns-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(snsPayload),
      })
      const json2 = await res2.json()
      if (!json2.ok) {
        setMsg(json2.error ?? 'SNSリンクの保存に失敗しました')
        return
      }

      // ③ パスワード変更（空ならスキップ）（既存）
      if (password !== '') {
        const { error: pwErr } = await supabase.auth.updateUser({ password })
        if (pwErr) {
          setMsg(`ユーザー名/SNSは保存できましたが、パスワード変更に失敗: ${pwErr.message}`)
          return
        }
        setPassword('')
      }

      // ✅ 正規化した値をstate側にも反映（表示用）
      setXUrl(snsPayload.x_url)
      setYoutubeUrl(snsPayload.youtube_url)
      setInstagramUrl(snsPayload.instagram_url)
      setTiktokUrl(snsPayload.tiktok_url)
      setWebsiteUrl(snsPayload.website_url)

      setMsg('保存しました ✅')
    } finally {
      setLoading(false)
    }
  }

  const hasAnySns =
    xUrl.trim() !== '' ||
    youtubeUrl.trim() !== '' ||
    instagramUrl.trim() !== '' ||
    tiktokUrl.trim() !== '' ||
    websiteUrl.trim() !== ''

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <p>
        <Link href="/">← トップへ</Link> / <Link href="/rooms">ルーム一覧</Link>
      </p>

      <h1 style={{ marginTop: 8 }}>プロフィール</h1>

      {!email ? (
        <p style={{ color: '#b00020', marginTop: 12 }}>ログインしてください（/login）</p>
      ) : (
        <>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 14, color: '#666' }}>メールアドレス</div>
            <div style={{ marginTop: 4, fontSize: 16 }}>
              <strong>{email}</strong>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              ユーザー名（2〜20文字）
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例：ねーそ"
              style={{
                width: '100%',
                border: '1px solid #ccc',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
              未設定だと投稿/参加で弾かれることがあります（事故防止）
            </div>
          </div>

          {/* ✅ SNSリンクセクション（追加・既存UIを崩さない） */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>SNSリンク</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
              空なら未設定扱い。入力する場合は http:// または https:// から始めてください。
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>X / Twitter</label>
              <input
                value={xUrl}
                onChange={(e) => setXUrl(e.target.value)}
                placeholder="https://x.com/your_id"
                style={{
                  width: '100%',
                  border: '1px solid #ccc',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              />
              {!isValidHttpUrlOrEmpty(xUrl) && (
                <div style={{ fontSize: 12, color: '#b00020', marginTop: 6 }}>
                  http:// または https:// から始めてください（空はOK）
                </div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>YouTube</label>
              <input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/@your_channel"
                style={{
                  width: '100%',
                  border: '1px solid #ccc',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              />
              {!isValidHttpUrlOrEmpty(youtubeUrl) && (
                <div style={{ fontSize: 12, color: '#b00020', marginTop: 6 }}>
                  http:// または https:// から始めてください（空はOK）
                </div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Instagram</label>
              <input
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://www.instagram.com/your_id/"
                style={{
                  width: '100%',
                  border: '1px solid #ccc',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              />
              {!isValidHttpUrlOrEmpty(instagramUrl) && (
                <div style={{ fontSize: 12, color: '#b00020', marginTop: 6 }}>
                  http:// または https:// から始めてください（空はOK）
                </div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>TikTok</label>
              <input
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@your_id"
                style={{
                  width: '100%',
                  border: '1px solid #ccc',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              />
              {!isValidHttpUrlOrEmpty(tiktokUrl) && (
                <div style={{ fontSize: 12, color: '#b00020', marginTop: 6 }}>
                  http:// または https:// から始めてください（空はOK）
                </div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Website</label>
              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                style={{
                  width: '100%',
                  border: '1px solid #ccc',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              />
              {!isValidHttpUrlOrEmpty(websiteUrl) && (
                <div style={{ fontSize: 12, color: '#b00020', marginTop: 6 }}>
                  http:// または https:// から始めてください（空はOK）
                </div>
              )}
            </div>

            {/* ✅ 保存後のリンク表示 */}
            {hasAnySns && (
              <div style={{ marginTop: 14, padding: 12, border: '1px solid #eee', borderRadius: 10 }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>登録済みリンク</div>

                <div style={{ display: 'grid', gap: 6, fontSize: 14 }}>
                  {xUrl.trim() !== '' && (
                    <a href={xUrl.trim()} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                      X / Twitter
                    </a>
                  )}
                  {youtubeUrl.trim() !== '' && (
                    <a
                      href={youtubeUrl.trim()}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: 'underline' }}
                    >
                      YouTube
                    </a>
                  )}
                  {instagramUrl.trim() !== '' && (
                    <a
                      href={instagramUrl.trim()}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: 'underline' }}
                    >
                      Instagram
                    </a>
                  )}
                  {tiktokUrl.trim() !== '' && (
                    <a
                      href={tiktokUrl.trim()}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: 'underline' }}
                    >
                      TikTok
                    </a>
                  )}
                  {websiteUrl.trim() !== '' && (
                    <a
                      href={websiteUrl.trim()}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: 'underline' }}
                    >
                      Website
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              パスワード変更（変更しないなら空でOK）
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
              type="password"
              style={{
                width: '100%',
                border: '1px solid #ccc',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            />
          </div>

          {msg && (
            <p style={{ marginTop: 12, color: msg.includes('失敗') ? '#b00020' : '#0a7' }}>{msg}</p>
          )}

          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            style={{
              marginTop: 16,
              padding: '10px 14px',
              border: '1px solid #111',
              borderRadius: 10,
              cursor: canSave ? 'pointer' : 'not-allowed',
              background: '#111',
              color: '#fff',
              opacity: canSave ? 1 : 0.5,
            }}
          >
            {loading ? '保存中…' : '保存'}
          </button>

          {/* ✅ 退会ボタンはログイン中だけ表示 */}
          <DeleteAccountButton />
        </>
      )}
    </div>
  )
}
