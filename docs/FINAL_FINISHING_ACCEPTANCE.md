# 最終仕上げ検収（第46節）
2026-10-21。最新の結論。過去節のWeb ACL未解消・migration20件という記述を以下で更新する。本番未アクセス・未変更。

## 1. 公開判定
**NO-GO**。Web権限エラーと主要Webフローは解消した。最終退会のFK/Storage/Auth保持処理、既存公開PIIと運営/復旧検収が未完。100%完成とは判定しない。

## 2. profiles
PASS（今回の最小読取契約）。authenticatedは本人の許可列だけ、anonはprivate profiles拒否。public_profilesはusername/bioのみ、内部id/退会状態/認証情報を公開しない。直接INSERT/UPDATE/DELETEは許可せず、既存認証APIで編集、同意は本人限定RPCへ。退会中のprofile公開を除外。実REST18件の一部とWeb編集/同意保存で検証。

## 3. room_members
PASS（今回の必要読取）。本人のmembership/left/role/joined_at/last_seenのみ。anon列挙・直接role/last_seen UPDATE拒否。既読は認証済みseen API。Creator管理は既存API、新Core RPCを使用。退出と承認の厳密な優先順位/ロック順は別P2として残る。

## 4. 一覧view
PASS。mvp_room_listはsecurity_invoker/security_barrier、room RLS＋公開列＋人数集計のみ。旧4viewへのclient access停止。hidden/deleted除外、host_ids/invite拒否。未公開制作ルームのタイトル・集計表示は既存仕様。未公開投稿本文を一般公開していない。

## 5. Web E2E
PASS（合成stagingの実UI）。login→同意→profile→一覧→作成→join/room同意→post/upload→既読→Core申請→却下→再申請→承認→draft→公開ログ確認→HTTP期限公開/再送→works一覧/詳細→like→report→public profile→logout→匿名作品/添付取得。
追加の署名URL検査ではsynthetic.txtの実bytes一致まで確認。Supabase email_confirm:trueで生成した合成Authを使用しており、実確認メール受信の代わりではない。
失敗履歴: テストのfetch Response.okを関数として呼ぶ誤りを修正。公開draftの匿名RLS権限エラーは022で修正。タイマーの初回時刻不一致を修正し、最終全走行のpageerror 0。
メール・refresh/全session失効・実退会・運営UI完全操作・100人負荷・復旧はこのE2Eに含まない。

## 6. Account deletion
- precondition: PASS。未公開Creator拒否、匿名名固定、同一job再送。
- FK: BLOCKED。Auth CASCADE/NO ACTIONとwrite fenceの衝突を監査schemaで再現。Auth DELETEはrollbackし本人行を保持する。
- anonymization: PARTIAL。新規受付の名前/bio/SNS/avatar/links除去とpublic profile非公開は確認。元UUIDの公開参照遮断と過去jobのPII補正は未実装。
- Storage: BLOCKED。既存cleanupは退会ownerを除外。使用済み保持と未使用cleanupの専用lease接続なし。
- Auth: BLOCKED。receipt全条件が未成立。最終worker未接続、Auth保持、退会UI/APIは準備中。
- retry: SDK/lease/failure mockはPASS、実FK/Storage/Auth最終連動は未検収。
具体的FK/移行/復旧条件はACCOUNT_DELETION_FINAL_GATES.md。技術実装不足であり、ユーザーの再承認待ちではない。

## 7. Storage
Web upload→台帳bind→制作ログ→公開→署名URL→bytes取得PASS。room_uploads private bucketをstagingに作成。既存所有権拒否/cleanupのoffline検査PASS。
使用済み/未使用/期限切れ/投稿削除/ルーム削除/退会/legacy所有objectの実連動マトリクス全体は未完。user prefix全削除、managed Storage SQL変更はしていない。

## 8. Core
staging12チェック再成功。最終枠競合・重複・退出/追放・別room/role・旧RPC拒否。Web却下/再申請/承認もPASS。既知の退出API非原子的role確認/ロック順課題はP2、無条件解決済みとはしない。

## 9. Forced publish
実HTTP cronと再送、実DBの同時RPC/公開日時保持、Web作品・ログ・添付までPASS。局所故障rollbackと再試行もnative検査で維持。

## 10. Moderation
staging schema26検査に通報保留・自動非表示Trigger・限定運営解決・退会運営拒否を含む。Web通報受付PASS。運営専用UI全工程/実担当者訓練は未検収。

## 11. Responsive
認証後profile/rooms/create/detail/works/detailの320/375/390pxで18チェック、通報フォーム3幅で3チェック、計21PASS。横overflow検査であり、実機のタッチ/読み上げ/全見た目品質を保証しない。

## 12. P1
**未解決3群以上、0未達。**
1. 最終退会の保持/匿名主体/FK/Storage/Auth整合性（受付停止中）。
2. 本番の広い権限/旧経路（本番未反映・今回再監査なし）。
3. 既存公開PIIと元識別子参照/個別除去・保持運用の検収不足。
全コードの新規完全監査を行った件数ではない。021/022で今回再現したWeb読取阻害は解消。P1=0や公開GOに換算しない。

## 13. Tests
今回再実行成功906チェック: offline697＋監査schema local73＋native競合31＋実staging63（client18/Core12/退会前提7/schema26）＋Web42（機能21/幅21、再開重複を除外）。
local73には適用前旧脆弱性再現とAuth削除失敗の再現を含む。これらの検査成功は安全な退会完成を意味しない。
tsc --noEmit、対象lint、通信遮断webpack build、git diff --check成功。Next middleware廃止予定警告のみ。PG/Next/Chrome停止確認。
ログ: finishing-*.txt、client-read-*.txt、staging-baseline-local-result.json、web-full-staging-result.json、各staging result。Web最終結果はfailures[]/complete:true。

## 14. migration
021 client_read_contract: 001〜020依存。profile/member/requests/likes/postsの最小読取、旧view停止、新一覧view、本人同意RPC。
022 work_snapshot_read: 021依存。匿名公開draftのmembership ACL依存解消、hidden/deleted/退会境界と許可列、updated_by非公開。
両方local検査後にstagingへ個別guard transactionで適用・履歴確認。001〜020不変。本番未適用。適用history SHAはLF正規化、finishing-migration-plan.jsonはファイルbytes hash。
rollbackは対象機能停止＋限定REVOKE/前進修正。旧広域view権限や直接DMLを戻さない。022を戻すと匿名作品が再度読めなくなるため、旧policy復活を自動rollbackにしない。

## 15. USER ACTION REQUIRED
実確認メール受信、運営窓口/当番と法務・実機の確認。本番PII audit/対応および本番反映は別途承認。ただし今は本番反映承認を求めない。
匿名名/未公開Creator拒否は既に採用。追加ローカル/staging実装は再承認不要。

## 16. Production rollout
未実行。preflight→backup/復元演習→互換追加schema→smoke→対応app反映→smoke→最小権限/旧経路停止→smoke→全退会ゲート合格後だけ退会有効化→final smoke→監視。
実行順の詳細と停止条件はPRODUCTION_ROLLOUT_PLAN.md末尾。現在は実行不可。staging bootstrapを本番へ適用しない。

## 17. Git状態
branch security/fix-storage-sign、既存大量差分/削除2件保持。commit/push/deploy/merge/reset/clean/stashなし。本番アクセス/変更なし。
今回: 021/022、TermsConsentGate、RoomsListClient/WorksListClient、RemainingTimer2本、staging検査/台帳、privacy回帰、証跡/引継ぎ。finishing-git-status.txtは既存分込み。

## 18. 次にすること
最優先は匿名保持主体＋限定prepare RPC、退会用Storage工程、最終Auth削除/再試行のstaging検証。その後Core退出競合、残Storage/運営UI/復旧/負荷、実メール・実機・運営/法務。
本番反映承認だけで完成する状態にはまだ達していない。AI_TASK blockedにはこの具体的未完了を記載する。

