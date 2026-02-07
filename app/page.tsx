// app/page.tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <h1 style={{ marginTop: 6 }}>みんなで作ろう（仮）</h1>

      <div
        style={{
          marginTop: 12,
          padding: 14,
          background: '#f3f6ff',
          borderRadius: 10,
          lineHeight: 1.8,
        }}
      >
        <p style={{ margin: 0, fontWeight: 700 }}>時間制限つき共同創作サービス</p>
        <p style={{ margin: '6px 0 0 0' }}>
          ルームに集まって、掲示板でアイデア出し・制作進行。期限が来たら自動で公開（forced_publish）になります。
        </p>
        <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>
          ざっくり手順：①プロフィールでユーザー名を設定 → ②ルームを作成 or 参加 → ③掲示板で制作 → ④期限で自動公開
        </p>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Link
          href="/rooms"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.15)',
            textDecoration: 'none',
            color: '#111',
          }}
        >
          制作ルーム一覧へ
        </Link>

        <Link
          href="/profile"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.15)',
            textDecoration: 'none',
            color: '#111',
          }}
        >
          プロフィール（ユーザー名設定）
        </Link>

        <Link
          href="/rooms/new"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.15)',
            textDecoration: 'none',
            color: '#111',
          }}
        >
          ＋ ルームを作成
        </Link>

        <Link
          href="/login"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.15)',
            textDecoration: 'none',
            color: '#111',
          }}
        >
          ログイン
        </Link>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, opacity: 0.75 }}>
        ※ 迷子防止のため、トップは説明＋導線に固定しています。
      </div>
    </div>
  )
}
