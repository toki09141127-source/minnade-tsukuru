# Web MVP 計測設計

2026-10-21。設計のみ。SDK、外部契約、実ユーザー計測、DB適用なし。

## イベント契約

共通：event_id UUID、schema_version=1、event_name allowlist、occurred_at(server UTC)、匿名session ID、認証後は内部actorの疑似ID、必要なroom ID、source、result_code。user本文/タイトル/email/username/token/署名URL/招待コード/生IP/URL queryは送らない。匿名IDも追跡用途を説明し保持期限を決める。時刻の信頼性とclient eventの偽装限界を明記する。

- signup：Auth登録確定時。メール確認開始と完了をresult_codeで区別。emailは不要。
- login：認証成功時のみ。再描画ごとに送らない。
- room_created：DB確定後、room IDで重複防止。creator membership部分失敗を成功に含めない。
- room_viewed：room可視性確認後、同session/room/30分窓で重複抑制。
- join_started：参加modal表示。参加方法の列挙値のみ。
- room_joined：membershipと同意確定後。room/actor/join generationで重複防止。
- first_post：参加後最初の成功投稿。server集計で判定し通常postと重複カウントしない。
- attachment_uploaded：台帳uploaded確定後。upload ID重複防止、MIME大分類/容量帯だけ。
- work_completed：期限公開/完成状態の遷移確定時、room ID+状態versionで重複防止。final無しは別flag。
- like：操作確定後、on/offを区別。toggle再送を新規likeと数えない。
- repeat_visit：前回の別日訪問後に再訪したsessionをJST日単位で集計。cookie拒否/別端末で欠測することを認める。

## 指標と診断

room_viewed→join_started→room_joined→first_post→work_completedの転換率を同じcohort/期間で集計。分母0は率を表示しない。登録日cohortの翌日/7日再訪率、投稿までの中央値、完了までの日数、upload失敗率、API5xx/429率を確認。管理者/テストデータは除外。100人では小標本なので順位や因果を断定しない。

## 自前DBか外部か

自前DBは少人数でevent schemaとデータ範囲を制御しやすいが、RLS/重複/保持/集計/削除/運用の実装が必要。外部計測は集計UIを短縮できるが、送信先・cookie・同意・保持・地域・料金・再委託の確認が必要。
推奨は初期100人ではserver確定イベントの最小自前集計から開始する案。DB容量/保持期間と担当の承認後に別migrationを作る。ブラウザ流入イベントは説明と同意設計後に追加。現段階で外部SDKや常時追跡を自動導入しない。

## 検収

合成ユーザーで1回の操作→1確定event、再送→重複なし、失敗→成功eventなし、退会→保持方針どおりの消去/集計化、未認証から他人event照会不可、イベントpropertyの未知キー拒否を確認する。

## ローカル型契約
lib/analyticsEvents.tsに最新依頼の16イベントallowlistと無効sinkを追加。従来文書の例から拡張。実計測/SDK/外部転送はまだなく、型定義だけでKPI収集が完成したとは扱わない。
