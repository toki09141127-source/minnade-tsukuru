# 主要導線の検証と公開前検収

2026-10-21。モック/合成DBの成功と実環境の成功を区別する。

## 今回実施

- 参加：旧API410、現行UI caller保持、未認証拒否、同意不足、可視性、人数45の逐次上限、既存core維持。
- core：承認/却下Bearer、検証済actor、別room申請拒否、RPCの権限エラーをモック確認。実RPC内の認可・人数競合は未証明。
- 投稿/添付：64 API検査、53合成DB検査、35形式/容量境界。未ログイン/非参加/退出済み/隠し・削除post/room/別room/同room他人path/不正pathを確認。
- 台帳：予約/完了/期限/owner/room/二重利用/同key再送/違うpayload/NULL role/status/FK削除/transaction rollback/直接権限拒否を確認。
- 投稿削除：本人active条件、非参加/退出/他人投稿拒否。
- 未読：API/SSR両方で未読NULLと既読room混在、非表示・削除post/room、退出を確認。共有sessionStorage依存を除去。
- cron：header認証、queryだけの拒否、secret無し、DB失敗、未来/期限無し/hidden/deleted/既公開/再実行0。
- いいね：本人、room可視性、連打拒否、DBエラー非成功。並行toggleは別検収。
- Privacy：fallback名が2〜20文字、email/Auth ID非由来、新規randomという3回帰検査。
- 連打：room create/join/core/like/reports/post/uploadでguard拒否時に本処理を呼ばない。
- ローカルブラウザ：ダミーURL/キーのbuildを127.0.0.1で起動。home→login→rooms→worksの遷移、未入力loginの説明、一覧の通信失敗、ラベル/再読込を確認。入力送信/実認証/実ユーザーデータ取得なし。

再実行：`npm run test:security`。5スクリプトを通信遮断preloadで実行。API126 + 添付64 + DB53 + upload35 + Privacy3 = 281検査。個数より上記境界を検収根拠とする。

## まだ合格にしない主要導線

新規登録/メール確認/再ログイン/再設定、プロフィール変更、room作成の部分失敗、検索/AIフィルタの実データ結果、参加とcore同意の原子性、承認拒否の実RPC、実Storage投稿/署名/削除、退出競合、final無し期限公開、作品一覧/詳細の既存object互換、like同時更新、公開profileのRLS、退会。この一連の成功・拒否・再送を合成データのstagingで通す必要がある。

## 実機・アクセシビリティ

確認/参加modalにfocus/Tab/Escape/復帰を追加、入力ラベルとrole=alert、狭幅grid/headerの折返しを改善。ブラウザの実ログイン状態のmodal操作、スクリーンリーダー、320/375/390/768px、iOS Safari/Android Chromeのfile picker・長文・ソフトキーボードは未実施。現ブラウザ操作ツールにviewport変更機能がなく、デスクトップ表示だけでスマホ合格としない。

検収：横スクロールなし、全操作keyboard可、Escapeで送信中の破棄なし、Tabがmodal外へ逃げない、閉じると元controlへ復帰、再openで同意未チェック、エラーで入力維持、長filenameでも送信ボタンが隠れない。

## 100人性能試験計画

本番に負荷を送らない。stagingの合成100アカウント、通常閲覧20並列/投稿5並列から開始し、上限100同時へ段階的に上げる。認可エラー0、post重複0、5xx<1%、主要read p95<1秒/投稿p95<2秒を暫定目標にし運営が承認する。uploadは4MB×頻度で転送費を測定、Storage署名/一覧/未読/通報の上限を測る。実績値はまだない。
未読はRESTの返却上限・全履歴scanが残るため、DB集約/ページングとindexを実スキーマ監査後に設計。view countのEXPLAINはユーザーデータを表示しない別承認の調査。DB/Storage/APIのp95、5xx、429、保存量、転送量、費用に停止基準を設ける。
## 追加回帰（2026-10-21、退会・通報方針作成時）

今回21検査追加、合計302（API監査147＋添付64＋形式35＋Privacy3＋PGlite53）。非表示/削除/NULL可視性/role・退出/別roomのmark拒否、post更新直前の非表示/削除/移動、可視post競合応答、退会APIの内部エラー非露出を確認。退会mockは実スキーマ整合/削除完了を検証しない。結果retention-tests.txt。

## 退会整合性の追加調査（2026-10-21）

ACCOUNT_DELETION_INTEGRITY.md参照。危険な退会APIをローカルで一時停止し、画面/APIとも未受付を明示。323合成・モック検査、型/対象lint成功。退会機能の完成・公開可能を意味しない。保持方針、正式受付、Trigger/Storage監査、永続的な再試行設計が残る。

## 第33節最終検証
413件（65+171+35+3+53+11+75）成功。tsc --noEmit --incremental false、対象lint、ダミー環境/通信遮断webpack build成功。対象lint既存警告5、エラー0。ログcompletion-tests/types/final-lint/final-extra-lint/build-webpack.txt。
新規completion-check.cjsで退会途中失敗/lease、role/kick、RLS、draft競合/公開、ログ本文/添付変更による審査失効を検証。EXIF付き合成JPEGを実sharp処理してmetadata除去と寸法を確認。
localhostの未認証画面と失敗表示をブラウザ確認。認証済み新UI/実機/実Auth/Storage/実トリガー/複数接続負荷は未検証。詳細WEB_MVP_COMPLETION_PASS.md。
