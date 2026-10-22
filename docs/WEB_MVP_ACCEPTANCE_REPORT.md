# Web MVP 最終検収フェーズ報告（第42節）

## 1. 現在の完成状態
総合NO-GO。公開ゲート16項目はPASS5 / FAIL2 / BLOCKED7 / USER APPROVAL REQUIRED2。
全740件成功（674 offline/合成＋31実PostgreSQL＋35未認証responsive）。成功率を完成率としない。
「残りはstagingと本番承認だけ」には未到達。実DB依存で安全に確定できない退会準備とCore承認の残実装がある。

## 2. 今回完了したこと
既存差分/hash・branchを記録、接続設定の存在確認、001〜017全件SQLレビューと依存/権限/rollback台帳。
018でMember45枠・membership identity固定・READ COMMITTED必須、新しい原子的参加/同意保存RPC。既存Core/Creatorの二重参加は降格しない。APIは既定無効MVP_ATOMIC_JOIN_ENABLED、失敗時に旧upsertへfallbackしない。
退会保持preflightの純粋判定・20テスト、staging検収/保持/法務/runbook/公開判定を整備。新機能拡張や本番接続はなし。

## 3. migration 001〜017
MIGRATION_ACCEPTANCE_MATRIX.mdに各目的・対象・破壊性・data migration・FK/CASCADE・RLS/GRANT・RPC/definer・Trigger・Storage/退会・前後依存・復旧を記録。018も追記。
ソースレビューと関連合成検査は済み、実Supabaseへの全順序適用は未実施。
001/005/014は権限縮小とschema追加が混在。純粋なschema先行フェーズと誤認しない。005を017後に再実行禁止、009既存jobありは停止。
外部Storage/Auth削除はDBrollback不可。DROP/旧広域権限復活で戻さない。

## 4. Account deletion
完成部分: 既存job/lease/CAS/snapshot/名義/書込停止/限定運営/Auth存在照合、今回preflight。
未完成: 実FK/Triggerとの移行・profile全情報除去・公開原本保持・Storage owner/保持・工程別証跡・運営再審査・完了通知。
推奨: 共同作品/他人投稿/構造保持、原則匿名名義、未公開Creator/eventは運営保留。自動移譲/room物理削除/架空Authは採用しない。
ACCOUNT_DELETION_FINAL_DESIGN.md。受付/実workerを有効にしていない。

## 5. Auth / Storage / Trigger
stagingを証明できない。repo config/linkなし、PATH CLIなし、envキー名のみ確認。productionらしき既存ブラウザを操作しない。
test accountのみのAuth/session/削除、所有者・使用済み保持・remove再送、実Trigger副作用/ACLの検収計画をSTAGING_ACCEPTANCE_PLAN.mdへ。
新しい本番事実を取得したとは主張しない。

## 6. 参加・Core・forced publish競合
独立接続・実lock待機を用いMember残1→1成功1満員、同user1行、kick両拒否、Creator保持、Core残1→Core4を検証。
Core検査はmembership guardであり、旧approve_core_request本体/申請state/後置同意UPDATEの原子性を保証しない。この既知不足は残る。
Triggerによる公開失敗でdraftもrollback、同時cronはskip、再試行で公開draft1件を検証。実既存公開Triggerはstaging待ち。

## 7. Privacy / PII
既存作品本文・productionデータ取得なし。運営管理環境内の決定的検出→目視審査→限定非表示/必要な訂正の設計。AIへ内容を送らない。
未使用upload24h、削除post30日審査、reports90日、audit/tombstone180日見直し、logs14日など運用候補を整理。法定期限ではなく自動削除も追加なし。
RETENTION_AND_PII_ACCEPTANCE.md参照。

## 8. 運営・法務
既存通報＋実在メール窓口1本、当番/代理を推奨。未設定連絡先は捏造しない。
LEGAL_REVIEW_CHECKLIST.mdへ共同制作/同意/退出・追放/編集/AI/学習/転載/人格権/未成年/退会/サービス終了の専門家質問を集約。法的適合の結論は出していない。

## 9. Tests
674 offline/合成、31実PostgreSQL、35Chrome responsive = 740成功。
typecheck / relevant lint / network-blocked webpack build / git diff --check成功。
新APIモック初回はRPC返値未登録で失敗、fixtureへ実契約を追加して全体再実行成功。
native100rate操作20接続は111ms、容量保証でない。画面検査は未認証7画面×5幅、認証済み/実機未検収。
ログ: acceptance-tests/concurrency/build/types/lint/responsive/diff.txt、responsive-smoke-results.json。実行用runtimeはアプリ依存外、package.json/lock今回未変更。起動した合成DB/ブラウザ/Nextserverは終了済み。

## 10. Go / No-Go
NO-GO。既知のproduction権限問題未反映、staging未検収、退会/旧Core整合/運営体制の不足。
PRODUCTION_GO_NO_GO.mdが正本。安全停止は公開完成ではない。

## 11. USER APPROVAL REQUIRED
1. 別staging ref・責任者・productionコピーなし/独立Auth/Storageの確認。
2. 共同作品保持/匿名表示/Creator運営保留方針の採用。
3. 実窓口・当番/代理・保持/法務・実機検収担当の決定。
4. staging対象manifest/結果確認後、別途production反映承認（現時点では依頼しない）。
安全な合成専用staging検収の一般承認は既にあるため再要求しない。

## 12. Production rollout
maintenance境界→互換安全停止app→001〜004→005/006→007〜012→013〜018→依存flag切替→After smoke→段階招待。
各段階にapply/smoke/Go-NoGo/rollbackを設定。清掃/Auth削除は別ゲート。上記はstagingでリハーサル後、最終承認してから。
PRODUCTION_ROLLOUT_PLAN.mdに準備コマンドを記載、実行していない。

## 13. Git状態
branch security/fix-storage-sign、開始時既存変更と既存削除2件を保持。
今回コード: app/api/rooms/join-supporter/route.ts、lib/accountDeletionPreflight.ts、migration018。
テスト: native競合/既存APIモック/runner、preflightとresponsive新規。文書はacceptance-changes.json参照。
commit / push / deploy / merge / reset / clean / stash / branch変更なし。本番DB/Auth/Storage/設定変更・実ユーザーデータ取得なし。

## 14. 次にユーザーがすること
まず隔離stagingのproject refと「本番コピーなし・test Auth/Storageのみ」を確認してください。
併せて保持方針候補と実窓口/検収担当を指定すれば、実定義照合→不足実装→staging検収へ進めます。本番承認は全ゲート合格後です。


## 第46節: 最終仕上げの結果（2026-10-21、最新）
総合NO-GO。詳細はFINAL_FINISHING_ACCEPTANCE.md（指定18項目）。旧節の「client ACLで全Webが止まる」は解消。
021/022をstaging fwqucffxdmbdczspkcyrへ適用。本人profiles/membershipだけの読取、公開profile列限定、新mvp_room_list、本人同意RPC、公開draftの匿名読取を整備。旧view/DMLは開けていない。
実Webは作成/参加/同意/投稿/添付/既読/Core却下→再申請→承認/期限公開/作品/like/report/profile/logout/匿名添付bytesまで完走。認証後18＋通報3の幅検査PASS。タイマーhydrationを修正。
今回906チェック成功（offline697/local監査schema73/native31/staging63/Web42、再開重複除外）。弱点/失敗条件再現を含むため完成率とはしない。型・対象lint・通信遮断build・diff成功。
退会Auth削除は監査schemaでwrite fenceとCASCADEの衝突を再現。FK保持主体/専用cleanup/元UUID公開遮断/既存job補正が未実装。UI/API準備中とAuth保持を維持、最終worker未接続。ACCOUNT_DELETION_FINAL_GATES.md参照。
P1未解決3群以上（退会整合性、本番未反映の権限/旧経路、既存公開PII/保持検収）。本番反映承認を求められる状態ではない。
次: 匿名保持主体＋限定prepare→退会Storage→Auth/再送の実検証→残E2E/復旧/運営。技術作業の追加承認不要。人手は実メール・運営窓口/当番・法務/実機。
branch security/fix-storage-sign。既存全差分/削除2件保持。今回021/022/UI/検査/台帳/docs変更。本番アクセス/変更、commit/push/deploy/merge/reset/clean/stashなし。sources不変。
