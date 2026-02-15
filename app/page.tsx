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

          {/* ★ボタン群 */}
          <div className="heroActions">
            <Link href="/rooms/create" className="btnPrimary">
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

        {/* ★説明文（刷新版） */}
        <div className="readableBox" style={{ marginTop: 14 }}>
          {/* 1) サービス1行説明 */}
          <p>
            <b>最大50人で、制限時間内に1つの作品を一緒に完成させる共同制作ルーム</b>です。
          </p>

          <p>
            ルームに集まって掲示板でアイデア出し・制作ログ・素材共有をし、期限が来たら自動で公開（forced_publish）されます。
            <br />
            「1人だと止まる」を、「みんなの勢い」で突破して、ちゃんと作品を完成させよう。
          </p>

          {/* 2) 参加の流れ（3ステップ） */}
          <h2>参加の流れ（3ステップ）</h2>
          <ol style={{ marginTop: 8 }}>
            <li>プロフィールでユーザー名を設定</li>
            <li>ルームを選んで参加（supporterで気軽にOK／coreは条件あり）</li>
            <li>
              掲示板で制作（ログ・画像/動画・最終提出）
              <b> ※投稿は「参加者のみ」</b>
            </li>
          </ol>

          {/* 3) core と supporter の違い（creator含む） */}
          <h2>役割は3つ：creator / core / supporter</h2>

          <p className="mutedLine" style={{ marginTop: 8 }}>
            役割によって「できること」と「退出ルール」が変わります。特に core の退出制限は重要です。
          </p>

          <ul style={{ marginTop: 10 }}>
            <li>
              <b>creator（制作者）</b>：ルーム作成者。進行役。
              <br />
              <b>退出不可</b>／ルーム削除可（＝強制終了）
            </li>

            <li style={{ marginTop: 10 }}>
              <b>core（制作者＋先着4名、合計最大5名）</b>：作品の意思決定・最終提出の中心。
              <br />
              <b>参加後5分以内のみ退出可</b>（5分経過後は退出不可）
              <br />
              参加方法：<b>制作者承認制</b> / <b>招待コード枠</b>（ルーム作成時にON/OFF）
            </li>

            <li style={{ marginTop: 10 }}>
              <b>supporter（最大45人）</b>：応援・アイデア・感想・資料共有・制作ログ参加など。
              <br />
              <b>自由参加・自由退出可</b>
            </li>
          </ul>

          {/* 4) 注意点 */}
          <h2>注意点（トラブル防止のために）</h2>
          <ul style={{ marginTop: 8 }}>
            <li>
              <b>coreの退出制限</b>：coreは意思決定の中心なので、途中で抜けると制作が止まりやすいです。
              <br />
              → そのため <b>「5分以内だけ退出可」</b> になっています（以降は退出不可）。
            </li>
            <li style={{ marginTop: 8 }}>
              <b>投稿条件</b>：掲示板への投稿は<b>参加者のみ</b>です（まずは supporter 参加が一番気軽です）。
            </li>
            <li style={{ marginTop: 8 }}>
              <b>成人向けルーム</b>：成人向け設定のルームは、閲覧前に確認が入ります。
            </li>
            <li style={{ marginTop: 8 }}>
              <b>マナー</b>：人格攻撃・荒らし・無断転載は禁止。困ったら通報してください（運営が対応します）。
            </li>
          </ul>

          {/* 5) FAQ（最低6） */}
          <h2>よくある質問（FAQ）</h2>

          <p style={{ marginTop: 8 }}>
            <b>Q. coreになりたい。どうすればいい？</b>
            <br />
            A. ルームによって違います。承認制がONなら「コア申請」→制作者が承認。招待コード枠がONならコード入力で参加できます。
          </p>

          <p>
            <b>Q. coreって、5分過ぎたら本当に退出できないの？</b>
            <br />
            A. できません。意思決定役が途中で抜けると混乱が起きるため、ルールで固定しています。参加前にだけ確認してください。
          </p>

          <p>
            <b>Q. 途中参加できる？</b>
            <br />
            A. できます。supporterはいつでも参加OK。coreは枠（最大5）と参加方法（承認/招待）次第です。
          </p>

          <p>
            <b>Q. 画像/動画は投稿できる？</b>
            <br />
            A. できます。制作ログや最終提出で画像/動画を添付できます（投稿は参加者のみ）。
          </p>

          <p>
            <b>Q. 公開タイミングは？</b>
            <br />
            A. 期限が来たら自動で公開（forced_publish）され、作品ページへ移動できます。
          </p>

          <p>
            <b>Q. 荒らし対策はある？</b>
            <br />
            A. 通報機能があります。運営側で投稿非表示・制限など対応します。安全第一で運用します。
          </p>

          <p className="mutedLine" style={{ marginTop: 14 }}>
            🔥 ひとこと：今日の「1行」でも、作品は前に進む。ここで一緒に完成まで走ろう。
          </p>
        </div>
      </div>
    </div>
  )
}
