# 第49節の追加検収（2026-10-22）

退会8gateの既存検収に加え、027の永続pause/Storage・Auth前checkpoint/二重effect防止/再開をstagingで検証した。A〜FすべてPASS。実staging29チェック、local監査schema119（うち追加16）成功。最新正本は [PRODUCTION_PREFLIGHT](PRODUCTION_PREFLIGHT.md) と [DELETION_STOP_RECOVERY](DELETION_STOP_RECOVERY.md)。

Technical STAGING GO、Operational NO-GO、本番反映は未承認。窓口は確定済み。旧節の実装完了証跡は保持し、今回の追加586を旧921へ単純加算しない。


<details>
<summary>第48節以前の記録（最新判断は上記を優先）</summary>

# 第47節: 最終退会ゲート（2026-10-22）
最新実装は023〜026。下の第46節は修正前の履歴で、未実装との記述は現在の状態ではない。

- precondition PASS: unpublished Creatorとactive CoreをDB/API/Webで拒否。
- prepare PASS: actor lock/job lease/個別行の変更前後一致で限定更新。途中失敗は全体rollback。
- anonymization PASS: 退会ごとの非Auth UUIDへ公開参照を変更、固定名義。元profile削除。共有Authユーザーなし。
- FK PASS: Auth参照をprivate actorsへ移行。投稿/部屋/参加/承認/イベント/決定/旧draft/ノートを保持。監査schema103検査。
- Storage PASS: 使用済み保持、台帳上unusedのみ隔離→SDKremove→metadata不在照合。late upload拒否。実故障注入後再試行。
- Auth PASS: receipt全条件検証後のみSDK削除。404 user_not_foundで不在確認。旧login/refresh/JWT書込拒否。
- retry PASS: prepare後中断、Storage失敗、Auth失敗を実stagingで再試行し完了。
- idempotency PASS: 二重申請は同じjob、completed再送、cleanup完了再送。既存lease/CAS回帰も成功。

証拠: deletion-final-staging-result.json（24）、staging-baseline-local-result.json（103）、web-full-staging-result.json（48）。
Webの公開Core/Creator退会後も共同作品と添付を匿名取得。全件が合成データ。これは本番稼働確認ではない。
MVP_ACCOUNT_REQUESTS_ENABLED/MVP_ACCOUNT_FINALIZE_ENABLEDは既定無効。検収用ローカルサーバーだけ有効化した。
再試行は本人再送またはsecret保護POST /api/cron/account-deletion（受付番号）で同じjobを進める。自動スケジュールは未設定。Auth削除後の応答喪失は運営workerで完了照合する。

## 復旧と未判定データ
Auth/Storage削除後はdown migrationで戻せない。機能停止、lease満了、同じjobの前進再開を基本にする。
台帳不明のStorageや新規未知FKは安全停止し調査する。所有者推測で削除しない。
新prepare以前に手動でprepared/auth_unknownまで進められたjobはreceipt不足で停止する。通常の新規受付には該当しない。移行時の既存job監査で検出し、stageを偽装せず個別補正する。
イベントの匿名所有者はログイン不可。共有履歴は保持し、運営による公開状態管理だけ許可する。

---

# 第46節: 最終退会を接続する前の整合性ゲート
2026-10-21。対象は監査済みschemaの隔離PostgreSQLとsynthetic stagingのみ。本番アクセスなし。
固定匿名名・未公開Creator拒否・共同作品保持は採用済み。方針の再承認待ちではない。

## 今回の確定事実
020の新規受付でprofilesのbio/SNS/deleted_at、public_profilesのbio/avatar/linksを処理し、投稿と履歴を保持する。021で退会中の本人profile・public profileを読取対象から除外する。
公開前Creatorは拒否、同一申請は同一job、Authは保持される。stagingの回帰検査で再確認。
監査schemaのMember退会後、local auth.users DELETEはACCOUNT_WITHDRAWAL_PENDINGになる。Auth CASCADEによるprofiles/membership等の削除を009/010の書込停止Triggerが拒否し、Authも元のままロールバックする。これは安全性の完成ではなく、最終削除が未接続である証拠。
work-read-local.cjsの最後の検査はこの失敗を意図して再現している。実Supabase Auth削除成功とは数えない。

## FKごとの保持判断と実装条件
- profiles.id/public_profiles.id: Auth CASCADE。PII除去後の削除を限定prepare経路で行い、名前同期Triggerとwrite fenceの衝突を確認する必要がある。
- room_members.user_id/room_join_requests.user_id: Auth CASCADE。参加・承認履歴を消してはならない。Authから独立した履歴主体へ参照を移すか、現在行を不可逆な匿名履歴へ移してから現在行を除去する。
- decisions.decided_by/room_pre_archive_notes.author_id: Auth CASCADE。作品成立に関わる履歴なので単純CASCADE不可。
- event_members.user_id/post_likes.user_id: Auth CASCADE。イベント参加履歴と集計を維持するか、匿名化後集計へ変換する条件を検証する。
- rooms.created_by/events.created_by: Auth NO ACTION。events.created_byはNOT NULL。ルーム/イベントをDELETEすると他ユーザーの子行がCASCADEし得るため削除で回避しない。Authを持たない匿名所有主体への置換が必要。
- room_members.approved_by/room_join_requests.decided_by/novel_drafts.updated_by: Auth NO ACTION。承認・更新者参照を保持用主体へ変換する。単にNULLへ変えるにもTriggerのwrite fence検証が必要。
- posts.marked_by: Auth SET NULL。更新Triggerが元のUUIDを検査するため、FK設定だけでは安全に削除できない。
- posts.user_id/room_likes.user_id: Auth FKなし。Auth削除でも元UUIDが残る。公開API/RESTからの元ID参照を切る必要がある。
- attachment_uploads.user_id: 001でAuth SET NULL。使用済み添付は維持。元UUIDの変更をwrite fenceが止めるため専用経路が必要。
- account_deletion_jobs/retention snapshots/audit: Auth削除から独立した私的記録。公開projectionへ出さず、保存期間・運営アクセスを別管理する。

## 推奨する移行方式（未実装・未適用）
1. privateな保持主体台帳を追加し、匿名主体IDをAuth IDと別に生成。旧Auth ID→匿名主体の対応はprivate schema/roleだけに限定する。
2. 作品/イベント/参加/承認履歴の保持先をこの主体へ段階移行する。Auth FKを先にDROPするだけの移行は禁止。通常の新規作成Triggerと全書込RPCも対応させる必要がある。
3. 退会受付のactor advisory lockとjob leaseを検証したSECURITY DEFINER prepare RPCで、対象job・対象行・変更前後を一致させる一回許可を発行する。任意のservice UPDATE/GUCで書込停止を解除しない。運営is_hidden専用capabilityと混用しない。
4. memberの活動状態停止、公開名前固定、元UUIDの公開projection遮断を同一DB工程で確定。現在のposts user_id/rooms created_by公開契約も修正してからAuthへ進む。
5. 全保持行数・作品内容hash・他人行数を検査し、FK拒否/匿名化失敗時はprepare全体をrollbackする。
6. unused Storageだけを下記専用工程で清掃し、検証証明を永続化。
7. SDK adapterの全receipt条件を満たした場合だけAuth削除。応答喪失は存在照合し、完了記録をCAS更新する。

## Storageが残る理由
013 cleanupは退会jobがあるownerを明示除外する。これを外すだけではwrite fence違反になる。
使用済み/公開作品/制作ログ/証跡の添付は保持。未使用でも台帳にないlegacy path、所有者不明、Auth所有objectはneeds_review。
専用cleanupはjob lease＋upload lease、正規bucket/path、未使用条件を検証して先にquarantineし、Storage SDK removeの後に消去確認・finishを行う。user prefix全削除とstorage.objectsへのSQL DELETEは禁止。
外部Storage削除後のDB finish失敗でも再送可能であること、使用済みobjectが残ること、Auth側owner検査を実stagingで確認する必要がある。今回はその最終連動は未実装。

## 再開・公開条件
準備後失敗/Storage失敗/Auth応答喪失/lease競合のSDKモックとlocal検査は既存suiteで継続して成功。これは実FK/Storage/Authの完成証明を代替しない。
Member/Core/公開Creator、used/unused、likes/reportsを含む実stagingの全caseを通すまで退会UI/APIは準備中。API/cronへ最終workerを接続していない。
既存020以前のjobについて匿名化を再実行する専用backfillも未実装。既存jobを黙ってpreparedへ変更しない。
技術的未完了であり、ユーザー承認を追加すれば解消する課題ではない。次工程はこの保持主体と限定prepare RPCの実装・故障注入検査。

## 復旧
Auth削除・Storage物理削除前にworker停止。準備工程はtransaction rollback、再送はjob leaseから再開。
Auth/Storage削除後はmigration downで復元できない。保持済み作品と監査を維持した前進復旧が必要。旧危険削除APIを復活させるrollbackは禁止。


</details>
