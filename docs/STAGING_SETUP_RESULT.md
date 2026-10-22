# Staging setup result — 2026-10-21 / 第44節

## 1. staging作成状態
CREATED。minnade-tsukuru-staging / fwqucffxdmbdczspkcyr。基礎schemaと001〜018をDashboard SQL Editorから個別transactionで適用済み。

## 2. productionとの分離確認
production joedeuyrzimqyjapqpyhには明示承認された2本のカタログ監査だけをBEGIN READ ONLY/ROLLBACKで実行。ユーザー行・作品・Storage object・sequence現在値を取得していない。DB/設定変更なし。
raw定義はリポジトリ外の利用者限定ACLディレクトリへ保存し、公開docsへ転記していない。stagingは独立キー・Auth・Storage・合成データのみ。本番env未変更。

## 3. 無料運用可否
既存Free組織/NANOを維持。課金・カード・プラン変更なし。同一組織の共有限度は残る。

## 4. migration 001〜018 staging結果
18/18の適用と各段階の構造smoke成功。baselineを含む19件をstaging_verification.migrationsにファイル名・hash付き記録。
証跡: staging-applied.json / staging-schema-plan.json。
今回は未適用だった009（内部名20文字制約）と011（自動非表示用対象列）を修正してから適用した。旧hashを再利用しない。
全アプリ検収PASSとは区別する。元のclient ACLは再現せず閉じた状態で開始し、005のroom列SELECT等だけを追加。Storage policyはコピー/変更なし。sequence MAXVALUEはJSON bigint精度問題を避け型既定値を明示採用。元DBの完全複製ではない。
適用済みmigrationの編集・再実行で更新しない。以後の変更は新しいmigrationとしてレビューする。

## 5. Auth結果
今回、新規合成6人で実Authトリガーによるprofiles生成を確認。前回6人を含め12人保持。認証情報はGit除外の利用者限定ACL下へ保存。
前回login/refresh/logout/独立session/使い捨てAuth削除を検証済み。公開signup・期限切れ・端末復帰・退会Auth削除フロー全体は未検収。

## 6. Storage結果
前回17項目に含むprivate bucket・PNG・署名URL・anon拒否・MIME/サイズ検証成功を維持。今回は追加Storage操作なし。
使用済み添付保持・退会・cleanup・本物の投稿との接続は未完。

## 7. RLS / GRANT結果
実stagingでanon/authenticated旧Core承認RPC拒否、authenticated直接role変更拒否、閉鎖baselineでanon posts SELECT拒否を確認。
匿名SELECT拒否は今回の閉鎖ACLでも成立するため、これだけで全RLSの意味的検収とはしない。必要な読取権限とWeb互換性の確定が残る。

## 8. RPC / Trigger結果
実staging22項目成功。原子的room作成/参加、同時二重join、自動非表示、退会中pending受付保持、再送、通常書込停止、運営一覧/対応済み再送/退会中運営拒否。
旧Core承認はP1未解消。実定義は引数のcreatorを信頼しauth.uid照合なし、退出Memberを同意なしで復帰させる。ローカル再現済み。005後の一般role直接呼出は閉鎖済みだがservice APIの後置同意UPDATEと復帰問題は残る。

## 9. Account deletion結果
匿名内部名40文字が実profilesの20文字CHECKに違反する問題を修正。公開名義/保持方針は変えない。内部名衝突時は全rollbackするローカル検証成功。
実stagingで匿名受付と書込停止・必要な運営操作を検証。Auth削除workerは停止、FK/イベント所有権/Storage保持と最終削除は未完。

## 10. Join / Core競合結果
実staging同user二重joinはmembership1件。ローカルPostgreSQL31複数接続検査成功。
Member最終1枠/Core最終枠の実Supabase競合・旧Core経路の置換は未完。

## 11. Forced publish結果
既存ローカル複数接続のrollback/retry/重複防止検査成功。実stagingでは未実行。

## 12. Responsive / 実機結果
前回のlocalhost匿名35項目成功。今回は再実行していない。stagingへ向けた認証済みWebフロー・実機未検収。通常npm devはproduction envを使い得るため起動していない。

## 13. Tests
今回696 offline + 12監査schema local + 31 native concurrency + 22 staging = 761検査成功。別途18本のstaging適用/構造確認成功。
変更lint・git diff --check成功。アプリTS/UI変更なしのためtype/build/responsiveは今回は再実行せず、前回成功結果と区別。
一度匿名退会で23514を再現し、009を修正後に再検証成功。ログstaging-baseline-*.txt、staging-schema-integration-result.json / run別JSON。
生SQL定義・パスワード・tokensはテスト結果へ出力していない。ローカルPG停止済み。

## 14. Go / No-Go
NO-GO。stagingの「適用できない」障害は解消したが、全機能の検収・復旧・運営/法務・保持判断が残る。
旧Core承認と退会最終処理のP1、既存公開作品PII、実UI/Storage連動/負荷・復旧が未解決。

## 15. USER ACTION REQUIRED
今回の2本の読み取り監査承認は実行済み、監査承認待ちは解消。
次のローカル作業に追加許可は不要。Creator退会時の未公開room管理移譲/保持・運営法務判断と、本番反映は引き続き別途承認が必要。
推奨順: 旧Core承認を同意・在籍・定員込みの原子RPCへ置換 → 必要なclient読取権限と認証済みWeb検収 → 添付/Storage/退会FK保持 → forced publish/競合/復旧 → 公開ゲート再判定。

## 16. Git状態
branch security/fix-storage-signのまま。既存差分と削除2件保持。今回の主な変更: migration009/011、通報fixture2本、staging baseline/適用準備/実検証script、監査案、manifest/証跡/引継ぎ。
commit / push / deploy / merge / reset / clean / stashなし。production DB/設定変更なし。
自動承認レビューが「002の確認結果を判定せず003へ進む」呼出を1度拒否。確認と条件分岐を明示した安全な手順に直して完了。残る承認ブロックなし。


## 第46節: 最終仕上げの結果（2026-10-21、最新）
総合NO-GO。詳細はFINAL_FINISHING_ACCEPTANCE.md（指定18項目）。旧節の「client ACLで全Webが止まる」は解消。
021/022をstaging fwqucffxdmbdczspkcyrへ適用。本人profiles/membershipだけの読取、公開profile列限定、新mvp_room_list、本人同意RPC、公開draftの匿名読取を整備。旧view/DMLは開けていない。
実Webは作成/参加/同意/投稿/添付/既読/Core却下→再申請→承認/期限公開/作品/like/report/profile/logout/匿名添付bytesまで完走。認証後18＋通報3の幅検査PASS。タイマーhydrationを修正。
今回906チェック成功（offline697/local監査schema73/native31/staging63/Web42、再開重複除外）。弱点/失敗条件再現を含むため完成率とはしない。型・対象lint・通信遮断build・diff成功。
退会Auth削除は監査schemaでwrite fenceとCASCADEの衝突を再現。FK保持主体/専用cleanup/元UUID公開遮断/既存job補正が未実装。UI/API準備中とAuth保持を維持、最終worker未接続。ACCOUNT_DELETION_FINAL_GATES.md参照。
P1未解決3群以上（退会整合性、本番未反映の権限/旧経路、既存公開PII/保持検収）。本番反映承認を求められる状態ではない。
次: 匿名保持主体＋限定prepare→退会Storage→Auth/再送の実検証→残E2E/復旧/運営。技術作業の追加承認不要。人手は実メール・運営窓口/当番・法務/実機。
branch security/fix-storage-sign。既存全差分/削除2件保持。今回021/022/UI/検査/台帳/docs変更。本番アクセス/変更、commit/push/deploy/merge/reset/clean/stashなし。sources不変。
