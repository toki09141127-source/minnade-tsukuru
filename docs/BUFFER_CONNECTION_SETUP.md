# Buffer接続確認（2026-10-22）

## 完了した設定
- Buffer登録・メール認証・X @minnade_tsukuru 接続をブラウザーで確認。
- Personal Key minntuku-x-automation、期限2027-01-20、権限3件を確認。秘密値は取得していない。
- Vercel sonetokiyas-projects/minnade-tsukuru の BUFFER_API_KEY が Secret / Production として保存済み。実値は取得していない。
- 接続先channel IDはBuffer画面で確認した 6ad9a93b778b240e2f8816f0。

## ローカル実装
POST /api/integrations/buffer/check。Authorization: Bearer（既存CRON_SECRET）必須。
サーバー環境変数のBUFFER_API_KEYをBuffer公式APIへのヘッダーにだけ使用する。
固定チャンネルのid/name/service/isDisconnected/isLocked/isQueuePausedのみを問い合わせ、
応答はokと固定codeだけ。本文・DM・他アカウント・秘密値は返さない。
10秒timeout、redirect拒否、no-store、GraphQLエラー・部分成功・型不整合を失敗にする。
投稿mutation、cron登録、DB変更は含まない。

## 検証
docs/buffer-connection-check.cjs は合成認証値・モックfetchだけで25ケースを検証。
実APIの成功とは区別する。Bufferの外部API疎通はまだ未確認。

## 次の実行条件
本体はAI_TASK第51節の公開前検収中。既存のreleaseタスク・差分を維持する。
この追加のみを理由に本番再デプロイしない。
リリース条件成立後、承認された配信に本routeを含め、Productionの新deploymentで
既存CRON_SECRETを安全な実行環境から送信してPOSTする。秘密値をチャット・ログへ出さない。
BUFFER_CONNECTEDなら読み取り接続確認成功。投稿権限の実動作確認は別工程。
Vercel環境変数は保存だけでは既存deploymentに反映されない（UIでも確認）。

## 自動投稿は未実装・未稼働
次工程は永続キュー、排他/再試行/重複防止、送信直前の公開・通報・PII・Creator除外確認、
日本時間の1日上限2件と通常夜1件、完成作品優先、新規ルーム日1件、
締切イベント失効、週次まとめ。未知の送信結果は無条件再送しない。
公開除外や検査結果をDBにどう保存するかを確定してからイベントを接続する。
重要告知の自動生成・送信は含めない。

## 公式API根拠
- https://developers.buffer.com/guides/getting-started.html
- https://developers.buffer.com/guides/rest-migration.html
- https://developers.buffer.com/types/Channel.html

