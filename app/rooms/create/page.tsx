// app/rooms/create/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '小説', label: '小説' },
  { value: '漫画', label: '漫画' },
  { value: 'アニメ', label: 'アニメ' },
  { value: 'イラスト', label: 'イラスト' },
  { value: 'ゲーム', label: 'ゲーム' },
  { value: '企画', label: '企画' },
  { value: '雑談', label: '雑談' },
  { value: 'その他', label: 'その他' },
]

export default async function RoomCreatePage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data?.user) redirect('/login')

  return (
    <div style={{ maxWidth: 820, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>ルーム作成</h1>
        <Link href="/rooms" style={{ textDecoration: 'none' }}>← ルーム一覧へ</Link>
      </div>

      <form
        action="/api/rooms/create"
        method="post"
        style={{
          marginTop: 16,
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 16,
          padding: 16,
          background: 'rgba(255,255,255,0.8)',
        }}
      >
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>タイトル</label>
        <input
          name="title"
          required
          maxLength={60}
          placeholder="例：少年漫画のネーム作る"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.2)',
            marginBottom: 14,
          }}
        />

        <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>カテゴリ</label>
        <select
          name="category"
          defaultValue="その他"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.2)',
            marginBottom: 14,
          }}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>対象</label>
        <select
          name="is_adult"
          defaultValue="false"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.2)',
            marginBottom: 14,
          }}
        >
          <option value="false">一般向け</option>
          <option value="true">成人向け</option>
        </select>

        <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>制限時間（時間）</label>
        <input
          name="hours"
          type="number"
          min={1}
          max={150}
          step={1}
          defaultValue={48}
          required
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.2)',
            marginBottom: 6,
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 14 }}>
          1〜150時間まで選べます（例：48 = 2日）
        </div>

        <button
          type="submit"
          style={{
            padding: '10px 16px',
            borderRadius: 12,
            border: '1px solid #111',
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          ルームを作成
        </button>
      </form>
    </div>
  )
}
