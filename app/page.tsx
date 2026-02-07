// app/page.tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <h1 style={{ marginTop: 6 }}>みんなで作ろう（仮）</h1>

      {/* サイト説明（ここは固定：指示がない限り変更しない） */}
<div
  style={{
    marginTop: 12,
    padding: 14,
    background: 'rgba(243, 246, 255, 1)',
    borderRadius: 10,
    lineHeight: 1.75,
    border: '1px solid rgba(60, 90, 255, 0.15)',
  }}
>
  <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>
    時間制限つき共同創作サービス「みんなで作ろう（仮）」
  </p>

  <p style={{ margin: '8px 0 0 0' }}>
    ここは、<b>制作ルーム</b>に集まって <b>掲示板でアイデア出し・制作進行</b> をし、
    <b>期限が来たら自動で公開（forced_publish）</b>される共同創作サイトです。
    <br />
    「1人だと止まる」を、「みんなの勢い」で突破して、ちゃんと作品を完成させよう。
  </p>

  <p style={{ margin: '10px 0 0 0' }}>
    <b>ざっくり手順：</b>
    ①プロフィールでユーザー名を設定 → ②ルームを作成 or 参加 → ③掲示板で制作 → ④期限で自動公開
  </p>

  <div style={{ marginTop: 12 }}>
    <p style={{ margin: 0, fontWeight: 800 }}>参加者の役割（コア / サポーター）</p>
    <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
      <li>
        <b>コア</b>：制作の中心メンバー。方向性の決定、締切までの進行、最終アウトプットの形づくりを担います（上限あり）。
      </li>
      <li>
        <b>サポーター</b>：応援・アイデア出し・感想・資料共有などで制作を支える参加者。気軽に参加しやすい枠です（上限あり）。
      </li>
    </ul>
    <p style={{ margin: '8px 0 0 0', opacity: 0.85 }}>
      ※ ルームによって動き方は自由。最初に「どんな完成を目指すか」「誰が何をやるか」を掲示板で決めると爆速で進みます。
    </p>
  </div>

  <div style={{ marginTop: 12 }}>
    <p style={{ margin: 0, fontWeight: 800 }}>このサイトでのマナー（気持ちよく創作するために）</p>
    <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
      <li>
        <b>否定から入らない</b>：まず「いいね / 面白い」を添えてから改善案を出す
      </li>
      <li>
        <b>短くても進捗を共有</b>：「今日はここまで」「詰まってる」だけでもOK
      </li>
      <li>
        <b>相手の作品・人格を傷つけない</b>：批評は内容に、言葉は丁寧に
      </li>
      <li>
        <b>著作権・転載は禁止</b>：無断転載や丸コピはしない（参考はOK、出典は書く）
      </li>
    </ul>
  </div>

  <p style={{ margin: '12px 0 0 0', fontWeight: 800 }}>
    🔥 ひとこと：今日の「1行」でも、作品は前に進む。ここで一緒に完成まで走ろう。
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
