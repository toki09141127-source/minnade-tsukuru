import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="pageWrap">
      <h1>みんなで作ろう（仮）</h1>

      {/* 説明ブロック（CSSでダークモード対応済み） */}
      <div className="homeHero">
        <p style={{ margin: 0, fontWeight: 700 }}>
          「みんなで作ろう（仮）」は、時間制限つきの制作ルームで、複数人が集まって作品づくりを進めるサイトです。
        </p>

        <p style={{ margin: '10px 0 0 0' }}>
          小説・漫画・ゲーム・音楽・動画など、ジャンルは自由。ルームに集まった人たちでアイデアや進捗を共有しながら、
          <b>「期限までに1つの完成形を出す」</b>ことを目指します。
        </p>

        <div className="homeHeroAccent">
          <p style={{ margin: 0, fontWeight: 700 }}>ざっくり手順</p>
          <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
            <li>
              <b>ユーザー名を設定</b>（表示名になります）
            </li>
            <li>
              <b>ルームを作成</b> するか、気になるルームに <b>参加</b>
            </li>
            <li>
              <b>掲示板</b>で制作を進める（案出し・分担・進捗報告・相談）
            </li>
            <li>
              <b>期限が来たら自動で公開</b>（status が <code>forced_publish</code> に切り替わり、投稿は止まって閲覧になります）
            </li>
          </ol>
        </div>

        <div className="homeHeroCallout">
          <p style={{ margin: 0, fontWeight: 800 }}>
            🔥 迷ってても大丈夫。まずは「1行」「1案」「1つの質問」からでOK。
          </p>
          <p style={{ margin: '6px 0 0 0' }}>
            締切があるから、創作は前に進む。今日ここから、あなたの作品を動かそう。
          </p>
        </div>
      </div>

      {/* ✅ PCは2列ボタン / スマホは1列ボタン */}
      <div className="linkRow" style={{ marginTop: 16 }}>
        <Link href="/rooms">制作ルーム一覧</Link>
        <Link href="/profile">ユーザー名を設定</Link>
        <Link href="/profile">プロフィール</Link>
        <Link href="/rooms/new">＋ ルームを作成</Link>
      </div>
    </div>
  )
}
