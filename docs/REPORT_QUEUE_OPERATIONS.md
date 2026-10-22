# 運営専用の処理待ち通報管理（2026-10-21）

## 実装
012_report_queue.sql、/api/moderation/reports、/moderation のReportQueueをローカル追加。
MVP_REPORT_QUEUE_ENABLEDは既定無効。一般公開や運営担当者登録、本番反映は行っていない。

一覧：report_intake.state=pendingかつ未対応の受付のみ。古い順(created_at,id)、50件/ページ。DBは次ページ検知用の51件まで。cursorは時刻とUUIDの組で、同じ時刻でも欠落/重複を防ぐ。
集計：全未対応数、24時間以上の件数、最古受付、確認時刻。24時間はMVPの目安で、SLAではない。更新ボタンで再取得する。自動通知/常時監視は今回作成していない。
一覧には通報者IDと内部SQLSTATEを含めない。対象/理由/受付ID/受付時刻のみ。理由はReactのテキストとして描画しHTML実行しない。
認証変更で一覧・入力・操作IDをクリア。API応答は成功/失敗ともno-store。ブラウザ永続ストレージに本文を保存しない。

## 対応済みの意味
report_intakeのpending/processedは旧reports INSERT処理の結果。人間の審査結果とは異なるので書き換えない。
report_resolutionsに受付ID、操作ID、担当者、hidden/no_action、必須対応理由、時刻を追加し、一覧から除外する。
- hidden：同transactionで既存限定mvp_moderateを実行し非表示、運営操作監査、対応済み記録を確定。
- no_action：公開状態を変えず、判断理由を記録。
受付ID一意、操作ID一意。対応済みの上書きは禁止。再送は完全に同じ担当者/受付/結果/理由のみ冪等成功。
既に単独運営操作に使ったrequest IDを流用して対応済みにすることも拒否。
実際に非表示失敗・監査保存失敗した場合は対応済みにならず、非表示と監査もrollbackする。
再審査/対応取消/対応履歴閲覧UIは未実装。現行UIは未対応一覧と確定操作のみ。監査テーブルは保持される。

## 権限・退会制限
service-only RPCでgetUser済みactorを使用。clientのactor指定は採用しない。
DBでも運営担当表をFOR SHARE、退会申請と同じactor advisory lockで退会中の担当者を拒否。JWT actorがあれば一致も必須。
一覧/集計も同じ権限検証を行い、非運営へ通報本文・件数を返さない。
report_resolutionsはRLS有効、一般ロールとservice_roleの直接アクセス権なし。専用definer RPCからのみ更新。
対象の退会状態を解除しない。投稿本文/名義/所有者/削除状態は変更しない。限定管理経路のis_hiddenだけを利用。
退会中の通報者が以前送信した受付も、現役運営担当者が審査可能。通報をAuth削除にCASCADEしない。

## 導入と運用
001〜011と012の整合性を隔離stagingで検収し、UI/API/DBを揃えてからqueue flagを有効化する。受付flagを先に本番有効化しない。
当番が定期的に「一覧を更新」で24時間以上の滞留を確認する。本文が個人情報を含む可能性があるためスクリーンショットの外部共有や汎用ログへのコピーを避ける。
対象IDと通報理由を確認して判断し、対応理由には必要最小限の記述を残す。隠した対象の復旧は既存の限定運営画面から行う。
実Triggerが副作用で限定経路に拒否される場合は未対応のまま保留する。SQL例外を握りつぶして対応済みにしない。

## 検証
SQL22件、API7件。既存530件と合わせ559件を全回帰runnerで実行。
権限拒否、退会中運営拒否、cursor/同一時刻、件数/滞留、非表示と対応監査の原子性、ID流用/二重対応拒否、失敗時rollback、非キャッシュ、本人ID固定を検証。
型・変更lint・通信遮断/ダミーwebpack buildを実行。証跡report-queue-*.txt。
実Supabaseの複数接続、実Trigger、実運営ログインでのブラウザE2E/モバイル/長期滞留は未検証。
集計と一覧はREAD COMMITTED内の別SELECTなので、同時処理による一時的な件数差は起こり得る。再取得で確認。複数接続ロック競合・deadlock再試行はstagingで検収する。
