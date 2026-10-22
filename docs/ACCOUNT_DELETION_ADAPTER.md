# 退会SDK接続と実DB監査の照合

## 今回の実績
ユーザー承認後、project joedeuyrzimqyjapqpyh のDashboardでカタログSQLを実行した。
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY / statement_timeout 15s / lock_timeout 2s / ROLLBACK。
初回に並べ替えの別名キャストを実式へ修正（取得範囲不変、実行前に説明）。Editorが最後のSELECT結果だけを表示するため、同じ承認済みSELECTのFK/列部分をそれぞれREAD ONLY/ROLLBACKで再実行。
列120件、FK32件、Trigger150件。全件JSONはaccount-deletion-metadata.json。ユーザー行・Storage内容・関数本文は取得していない。SQL文は保存したが本番データ・設定の変更はない。

## 実環境で確認した事項
- rooms.created_by、room_members.approved_by、room_join_requests.decided_byはnullableだが、Auth FKはNO ACTION。NULL化だけを実行すれば十分とは判断できない。
- events.created_by、novel_drafts.updated_byにもAuth NO ACTION FKがある。従来の3列だけの処理では不足。
- decisions.decided_by、event_members.user_id、room_pre_archive_notes.author_id、post_likes.user_id、profiles.id、public_profiles.id、room_members.user_id、room_join_requests.user_idはAuth CASCADE。
- postsのAuth FKはmarked_by SET NULLのみ。posts.user_idはNOT NULL、Auth FKなし。投稿usernameもNOT NULLで、Auth削除だけで匿名化されない。
- storage.objects/bucketsのownerとowner_idはnullable。今回取得したAuth参照FKにこれらはない。ただしAuthサービス側の所有チェックがない証明ではない。
- storage.objectsとbucketsにはprotect_delete Triggerがある。SQL直接DELETEでStorageの実ファイルも消えると仮定しない。
- fill_post_username、set_posts_edited_at、enforce_core_limit、Authのhandle_new_user_profile等が有効。本文未取得なので保持・名義変更時の副作用は未確定。
- 監査時attachment_uploadsの列行はない。ローカルmigration未適用のまま。

## 安全に接続した部分
lib/accountDeletionAdapter.ts：SupabaseClientを明示注入するSDK adapter。API/cronへ自動接続しない。
- 永続job claim、advance（期待stage+lease）、renew、releaseを既存ワークフローへ接続。
- getUserById/deleteUserをSDK経由で接続。404かつuser_not_foundのみ不在と扱い、403/5xx/不明な404/異なるIDを拒否。
- Auth操作の前に同一job/actorの準備証明と生きたleaseを再確認。準備証明には書込停止・共同作品保持・名義処理・FK照合・Storage対応の全条件が必要。
- 未監査の既定preparationはneeds_reviewで止まり、Auth/Storageへ進まない。準備済みと偽って成功するstubは使わない。
- finalizationが失敗/未完ならcompletedにしない。Auth削除の応答喪失後は存在照合で再開。
- lease期限切れの復活を拒否し、古いworkerのreleaseで新しいleaseを消さない。
- claim自体の障害もretryとして扱う。
007_deletion_lease.sqlはローカル候補のみ。既存FKやAuthは変更しない。

## 未接続の保持・削除処理
実際のprepare/finalize実装はまだ有効化できない。新たなCASCADE先を保持対象から黙って外すこと、未監査Triggerを通る一括UPDATE、Storageの全消去、Auth削除を先行する処理は採用しない。
具体的に必要な処理：
1. 受付と全書込経路の停止を原子的に確定。既存API/RPC/直接RLS/プロフィール同期も停止対象。
2. 匿名/名義保持の選択をposts.usernameと独立した公開author記録へ反映。共同制作のdecision/pre-archive note/参加履歴を消さずに保持できる移行を準備。
3. roomsだけでなくevents/novel_draftsの所有・更新者の扱いを確定。必要な参照付替えと名義処理を一つのDBトランザクションで実施。
4. 参照中の添付を保持。未使用/失敗uploadのみ台帳で確定し、Storage APIによる清掃を再試行可能にする。所有者変更・Auth削除可否は隔離stagingで確認。
5. prepared後も書込停止を維持し、準備の検証結果をDBに永続化。Storage/Authの外部操作はDBトランザクションではrollbackできない。
今回のreceipt interfaceはこの実処理の契約であり、保持・削除機能の完成ではない。受付flagは無効を維持。

## 検証・限界
account-deletion-adapter-check.cjs：SDKモック、実PGliteのlease CAS、追加FK/CASCADE再現。全て合成IDでネットワーク遮断。実Auth削除・Storage操作なし。
leaseを外部HTTPと原子的に固定することはできない。遅い/重複workerにも耐えるprepare/finalizeの冪等性と外部結果照合が必須。
Supabase実環境の削除成功、トリガー本文安全性、アプリの全書込停止、実ファイル保持は未検証。募集開始不可・全体in_progressを維持。
