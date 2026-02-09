// app/page.tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="container">
      <h1 className="h1">みんなで作ろう（仮）</h1>

      {/* ★装飾付きのHero枠 */}
      <div className="heroWrap">
        <div className="heroTopRow">
          <div className="heroTitle">
            <span className="heroBadge">⏳ 時間制限つき / forced_publish</span>
            <span className="heroBadge">🧑‍🤝‍🧑 共同制作</span>
            <span className="heroBadge">📝 掲示板</span>
          </div>

          {/* ★ボタン群（ルーム作成を復活） */}
          <div className="heroActions">
            <Link href="/rooms/new" className="btnPrimary">
              ＋ ルームを作成
            </Link>
            <Link href="/rooms" className="btnGhost">
              制作ルーム一覧
            </Link>
            <Link href="/works" className="btnGhost">
              完成作品
            </Link>
            <Link href="/terms" className="btnGhost">
              利用規約
            </Link>
          </div>
        </div>

        {/* ★説明文（内容は一切変えない） */}
        <div className="readableBox" style={{ marginTop: 14 }}>
          <p>時間制限つき共同創作サービス「みんなで作ろう（仮）」</p>

          <p>
            ここは、制作ルームに集まって 掲示板でアイデア出し・制作進行 をし、期限が来たら自動で公開（forced_publish）される共同創作サイトです。
            <br />
            「1人だと止まる」を、「みんなの勢い」で突破して、ちゃんと作品を完成させよう。
          </p>

          <p className="mutedLine">
            ざっくり手順：①プロフィールでユーザー名を設定 → ②ルームを作成 or 参加 → ③掲示板で制作 → ④期限で自動公開
          </p>

          <h2>参加者の役割（コア / サポーター）</h2>
          <p>
            コア：制作の中心メンバー。方向性の決定、締切までの進行、最終アウトプットの形づくりを担います（上限あり）。
          </p>
          <p>
            サポーター：応援・アイデア出し・感想・資料共有などで制作を支える参加者。気軽に参加しやすい枠です（上限あり）。
          </p>
          <p className="mutedLine">
            ※ ルームによって動き方は自由。最初に「どんな完成を目指すか」「誰が何をやるか」を掲示板で決めると爆速で進みます。
          </p>

          <h2>このサイトでのマナー（気持ちよく創作するために）</h2>
          <ul>
            <li>否定から入らない：まず「いいね / 面白い」を添えてから改善案を出す</li>
            <li>短くても進捗を共有：「今日はここまで」「詰まってる」だけでもOK</li>
            <li>相手の作品・人格を傷つけない：批評は内容に、言葉は丁寧に</li>
            <li>著作権・転載は禁止：無断転載や丸コピはしない（参考はOK、出典は書く）</li>
          </ul>

          <p>🔥 ひとこと：今日の「1行」でも、作品は前に進む。ここで一緒に完成まで走ろう。</p>
        </div>
      </div>
    </div>
  )
}
