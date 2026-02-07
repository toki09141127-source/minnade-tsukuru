import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="pageWrap">
      <h1>制作ルーム一覧</h1>

      {/* 説明ブロック（ダークモード対応はCSSで） */}
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

        <div style={{ marginTop: 12 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>参加者の役割（コア / サポーター）</p>
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
          <p style={{ margin: 0, fontWeight: 700 }}>このサイトでのマナー（気持ちよく創作するために）</p>
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

        <div className="homeHeroCallout">
          <p style={{ margin: 0, fontWeight: 800 }}>
            🔥 迷ってても大丈夫。まずは「1行」「1案」「1つの質問」からでOK。
          </p>
          <p style={{ margin: '6px 0 0 0' }}>
            締切があるから、創作は前に進む。今日ここから、あなたの作品を動かそう。
          </p>
        </div>
      </div>

      {/* リンク（スマホは縦並び＆押しやすくなる） */}
      <div className="linkRow" style={{ marginTop: 16 }}>
        <Link href="/rooms">制作ルーム一覧</Link>
        <Link href="/profile">ユーザー名を設定（プロフィール）</Link>
        <Link href="/rooms/new">＋ ルームを作成</Link>
        <Link href="/profile">プロフィール</Link>
      </div>
    </div>
  )
}
