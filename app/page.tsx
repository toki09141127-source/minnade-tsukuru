// app/page.tsx
import Link from 'next/link'
import { supabaseAdmin } from '../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // トップでも一覧を出す（軽く最新50件）
  const { data: rooms } = await supabaseAdmin
    .from('rooms')
    .select('id, title, work_type, status, time_limit_hours, created_at, like_count')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div style={{ padding: 24 }}>
      <h1>みんなで作ろう（仮）</h1>

      {/* 説明 */}
      <div style={{ marginTop: 12, padding: 12, background: '#f3f6ff', borderRadius: 8, lineHeight: 1.7 }}>
        <p style={{ margin: 0 }}>
          「みんなで作ろう（仮）」は、時間制限つきの制作ルームで、複数人が集まって作品づくりを進めるサイトです。みんなでアイデアを出し合って最高の作品を作りましょう！！
        </p>
        <p style={{ margin: '8px 0 0 0' }}>
          ざっくり手順：①ユーザー名を設定 → ②ルームを作成 or 参加 → ③掲示板で制作を進める → ④期限が来たら自動で公開（forced_publish）
        </p>
      </div>

      {/* 4リンク */}
      <div style={{ marginTop: 16, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Link href="/rooms">制作ルーム一覧</Link>
        <Link href="/set-username">ユーザー名を設定</Link>
        <Link href="/profile">プロフィール</Link>
        <Link href="/rooms/new">＋ ルームを作成</Link>
      </div>

      {/* 一覧（トップ簡易版） */}
      <h2 style={{ marginTop: 28 }}>新着ルーム</h2>
      <p style={{ marginTop: 6, opacity: 0.8 }}>
        もっと探す：<Link href="/rooms?sort=likes">いいね順</Link> / <Link href="/rooms?sort=new">作成順</Link> /{' '}
        <Link href="/rooms">検索</Link>
      </p>

      <div style={{ marginTop: 12 }}>
        {rooms?.length ? (
          <ul style={{ paddingLeft: 18 }}>
            {rooms.map((r) => (
              <li key={r.id} style={{ marginBottom: 10 }}>
                <Link href={`/rooms/${r.id}`} style={{ fontWeight: 'bold' }}>
                  {r.title}
                </Link>{' '}
                <span style={{ opacity: 0.8 }}>
                  （{r.work_type} / {r.time_limit_hours}h / {r.status} / ❤️ {r.like_count ?? 0}）
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>ルームがありません。</p>
        )}
      </div>
    </div>
  )
}
