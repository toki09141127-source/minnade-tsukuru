# 通報受付の保持（2026-10-21）

## 実装
011_report_intake.sqlはローカル候補。既存自動非表示関数は変更しない。
mvp_receive_reportは本人・入力・退会申請の有無を確認し、report_intakeへ受付を保存した後、内部の例外処理ブロックで既存reportsへINSERTする。
- reports INSERTとそのTriggerが成功：受付state=processed。
- 退会書込停止やその他の通常SQLエラー：その内部ブロックだけrollbackし、受付はpendingとして確定。例外本文は保存せずSQLSTATEのみ記録。
- 初回受付保存失敗やトランザクション全体の中断：成功を返さない。
- actor+request UUIDを一意化。応答喪失後の同一送信は同じreceipt。内容変更は拒否。
- pending再送では旧Triggerを再実行しない。運営が内容・対象を確認して限定管理経路で対応する。
report_intakeは一般roleの読取/書込不可。AuthへのCASCADE FKを設けないため受付はAuth削除で消えない。保持期間・削除運用は別途必要。
退会中の通報者は不可。reportsの実列reporter_user_idも書込停止Triggerの対象に追加（従来の汎用候補はreporter_idのみ認識）。
通報対象の退会状態に対する書込停止は解除しない。自動非表示を強制成功させない。

## API/UI
MVP_REPORT_INTAKE_ENABLED=true時のみ新RPC。処理待ち受付はHTTP202、従来処理まで成功なら200。どちらも受付IDを返し非表示成功とは表示しない。
RPC障害時に旧INSERTへfallbackしない。UUID/文字数/本人確認/既存rate limitを維持。
UIは同じログイン利用者・対象・理由の再送に同じrequest IDを使用。成功後に破棄、内容が変われば別ID。
ID保持はコンポーネント内のみで、リロード後までのexactly-once保証ではない。通報本文をlocalStorageへ保存しない。
フラグは変更していない。無効時は既存経路のままで今回の保護は適用されない。

## 承認済み実監査
supabase-report-trigger-audit.sqlをユーザー承認後、READ ONLY/ROLLBACKで実行。最後のSELECTのみ表示されるため、列SELECTも同じ条件で個別実行。
reportsは11列。id bigint、reporter_user_id uuid NOT NULL、target_type text、target_id uuid、reason text。detail、reporter_id、target_room_id、target_post_id等も存在。
tr_reports_auto_hide：enabled O、tgtype=5（ROW/AFTER INSERT）、引数0、public.apply_auto_hide（OID23728）SECURITY DEFINER。
定義の変更検知ハッシュと列/Triggerメタデータはreport-trigger-metadata.json。実ユーザーデータ・通報本文・関数本文・秘密値は取得していない。
自動非表示の閾値・対象判定・関数内例外・外部副作用は未確認。今回の合成Triggerは「INSERT後に非表示UPDATEする」故障再現であり、実関数全体の再現ではない。

## 検証
追加SQL17件＋API6件、既存507件と合わせ530件成功。型・対象lint・通信遮断/ダミーwebpack build成功。report-intake-tests/types/lint/build/diff.txt。
受付保持、旧INSERTのみrollback、書込停止維持、同一再送、相違再送拒否、通常成功、未知のTriggerエラー、秘密例外非露出、退会中/未認証/偽装拒否、一般読取拒否、受付自体の保存失敗を検証。
QUERY_CANCELED/ASSERT_FAILUREなどWHEN OTHERSが捕捉しないエラー、接続切断やDB停止で全transactionが中断した場合は受付未確定の可能性がある。同一request IDの再試行が必要。全障害で無条件に保存できるとは約束しない。

## 運用・反映前の条件
pendingはreport_intakeにあり、reportsだけを見る運用では見落とす。運営専用一覧・滞留監視・対応済みの監査付き更新経路は未実装。ここを整備してから有効化する。
現段階で運営が対応する場合も、認可された管理経路で受付確認→既存mvp_moderateによる限定非表示/復旧。pendingを手でprocessedと書き換えて旧Trigger成功に見せない。
011は既存001〜010と照合し隔離stagingで適用。実reportsの制約/既定値/権限、複数通報同時実行、rate limit、実Triggerの副作用、運営一覧を検収。
受付保護を有効にするリリースではAPI/UI/DBをセットにし、旧クライアントのrequestId欠落への移行案内が必要。
本番migration/設定/データ変更・commit/push/deployなし。
