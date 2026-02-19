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

  // ✅ bio（紹介文）
  const [bio, setBio] = useState('')
  const bioCount = bio.length
  const bioOk = bioCount <= 300

  // ✅ SNS links
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
        // ✅ selectにbioを追加
        const { data: prof } = await supabase
          .from('profiles')
          .select('username, bio, x_url, youtube_url, instagram_url, tiktok_url, website_url')
          .eq('id', u.user.id)
          .maybeSingle()

        setUsername((prof?.username ?? '').toString())
        setBio((prof?.bio ?? '').toString())

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

    const urlsOk =
      isValidHttpUrlOrEmpty(xUrl) &&
      isValidHttpUrlOrEmpty(youtubeUrl) &&
      isValidHttpUrlOrEmpty(instagramUrl) &&
      isValidHttpUrlOrEmpty(tiktokUrl) &&
      isValidHttpUrlOrEmpty(websiteUrl)

    return nameOk && passOk && urlsOk && bioOk
  }, [username, password, loading, xUrl, youtubeUrl, instagramUrl, tiktokUrl, websiteUrl, bioOk])

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
    if (!bioOk) {
      setMsg('紹介文は 300文字以内 にしてください')
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

    // ✅ bio payload（空は null 扱い）
    const bioTrim = bio.trim()
    const bioPayload = { bio: bioTrim ? bioTrim : null }

    setLoading(true)
    try {
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

      // ② SNSリンク更新（既存）
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

      // ③ bio更新（追加：Route Handler）
      const res3 = await fetch('/profile/set-bio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bioPayload),
      })
      const json3 = await res3.json().catch(() => ({}))
      if (!json3.ok) {
        setMsg(json3.error ?? '紹介文の保存に失敗しました')
        return
      }

      // ④ パスワード変更（既存）
      if (password !== '') {
        const { error: pwErr } = await supabase.auth.updateUser({ password })
        if (pwErr) {
          setMsg(`ユーザー名/SNS/紹介文は保存できましたが、パスワード変更に失敗: ${pwErr.message}`)
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

      setBio(bioTrim) // nullの場合は空欄として表示

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

          {/* ✅ 紹介文（bio） */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>紹介文（公開プロフィールに表示）</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
              300文字以内。空なら未設定扱い。
            </div>

            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              placeholder="例：創作ジャンル / 得意なこと / 参加したい制作 / 好きな作品 / SNS誘導など"
              style={{
                width: '100%',
                minHeight: 120,
                border: '1px solid #ccc',
                borderRadius: 10,
                padding: '10px 12px',
                marginTop: 10,
              }}
            />
            <div style={{ fontSize: 12, color: bioOk ? '#666' : '#b00020', marginTop: 6 }}>
              {bioCount}/300
            </div>

            {!bioOk && (
              <div style={{ fontSize: 12, color: '#b00020', marginTop: 6 }}>
                300文字以内にしてください
              </div>
            )}
          </div>

          {/* ✅ SNSリンクセクション（既存） */}
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
                    <a href={youtubeUrl.trim()} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                      YouTube
                    </a>
                  )}
                  {instagramUrl.trim() !== '' && (
                    <a href={instagramUrl.trim()} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                      Instagram
                    </a>
                  )}
                  {tiktokUrl.trim() !== '' && (
                    <a href={tiktokUrl.trim()} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                      TikTok
                    </a>
                  )}
                  {websiteUrl.trim() !== '' && (
                    <a href={websiteUrl.trim()} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
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

          <DeleteAccountButton />
        </>
      )}
    </div>
  )
}
