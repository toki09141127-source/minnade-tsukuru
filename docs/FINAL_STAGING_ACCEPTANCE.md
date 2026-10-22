# 最終staging検収報告（2026-10-21）
最新対象: fwqucffxdmbdczspkcyr。productionへ今回アクセス・変更なし。
過去の記録は当時の結果。以下を最新の判定とする。

## 1. 現在の公開判定
**NO-GO**。本番反映の承認だけが残った状態ではない。

## 2. 今回完了したこと
019 Core承認原子化、020退会前提/プロフィール除去を追加しstaging適用。001〜018は変更していない。
APIのRPC引数不一致を修正。既存差分を保持。staging専用Web起動/通信先制限/別buildディレクトリを追加。

## 3. 旧Core承認
現行request/approve/reject APIをmvp_request_core/mvp_decide_coreへ統合。Member在籍snapshot・同意・定員・決定を原子的に確認。
旧先着/招待Core APIは410、詳細UIから除去。作成画面の招待選択は無効、承認制を既定ON、OFFは申請不可と明示。
旧approve/reject/join_core_first_come/join_core_by_invite/join_room RPCはservice_roleも含めEXECUTEを剥奪。関数定義は保存、DROPなし。
既存承認OFFルームに勝手に設定変更しない。Core辞退のCreator承認は将来仕様で未実装。
公開後は承認拒否するが、pending行を一斉にexpiredへ変更する処理は未実装。
019のunique partial index適用前に既存pending重複を本番preflightで確認する必要あり。

## 4. Account deletion
**全体FAIL（未完成・受付既定無効）**。部分検証PASS: 未公開Creator拒否、匿名名義、bio/SNS/avatar参照/links除去、共同投稿保持、再送、書込停止。
020適用前に作成されたjobは再送で旧jobを返すだけ。旧jobのPII補正は別の監査付き工程が必要。
Auth FKのNO ACTION/CASCADE、events NOT NULL所有者、Storage owner依存は未解決。Auth削除workerを有効化していない。
public profile参照除去はStorage object物理削除とは異なる。メール/Auth metadataはAuthを残しているためまだ存在する。
他人の投稿、使用済み添付を削除していない。Auth/Storage最終失敗・復旧stagingケースは未検収。

## 5. Web E2E
PASS: 実画面の誤パスワード拒否、合成アカウントでstaging Auth login、reload、認証後profileの5画面幅。
BLOCKED: profile編集/同意保存、room一覧・作成・参加、投稿/添付/unread/Core/like/report/作品/profile/退会の一連UI。
実authenticated RESTでprofiles / room_members / rooms_with_counts_v2が42501。閉鎖baselineの権限がWeb契約を満たさない。
失敗画面のレイアウト成功を機能成功として扱わない。ルーム作成など他flag有効化も検収前に必要。
次は必要な列だけのGRANTと非再帰RLSを個別設計し、他人の非公開情報を読めない試験と組にする。元の広い権限を一括復元しない。

## 6. Auth
今回Web login/invalid password成功。前回の基礎Auth smokeは別証跡。
実確認メール受信/signup、期限失効、複数tab、アプリ退会後login拒否は未検収。実メール受信手段はUSER ACTION REQUIRED。

## 7. Storage
前回のprivate bucket/署名/匿名拒否検証を維持。今回はStorage変更なし。
unused/orphan cleanup、used/published/deleted-post保持とAuth削除の連動は未検収。
owner prefixで一括削除しない。既存台帳lease/everUsed判定を利用し、管理対象が確認できないobjectは保留。

## 8. RLS / RPC / Trigger
staging baseline＋001〜020適用済み。019/020は別transaction、環境marker照合、適用履歴確認。
旧Core直接実行、一般role昇格拒否、実通報auto-hide Trigger、退会書込停止と限定運営RPCの互換性を確認。
client ACL不足が残る。全RLS/ビュー互換性のPASSではない。

## 9. Join / Core競合
staging Core12項目PASS。残1枠2承認で成功1人/activeCore4、敗者pending保持、同一申請再送、申請重複、退出/追放競合、別room/nonCreator/不正同意/直接RPC拒否。
退出/追放の最終在籍はinactive。承認が先にcommitした場合、昇格履歴は残り得る。競合でdeadlock被害側は再試行している。
従って「一瞬も昇格しない」という厳密条件は未達。leave APIのrole確認とUPDATEの原子化、ロック順統一、API再試行を追加課題とする。
Member45の残1枠はlocal複数接続でPASS。stagingは重複joinを確認したが45人枠競合を今回実行していない。

## 10. Forced publish
stagingで期限を到来させ、2本同時RPC、work_drafts1件/room forced_publish、再実行で公開日時保持、anon拒否PASS。
HTTP cron→画面の作品一覧/詳細/添付までのE2Eは未検収。localで失敗rollbackと再試行もPASS。

## 11. Moderation
最新schema suite26件中に、実Trigger三件目auto-hide、退会著者による保留受付、再送、運営の非表示/解決、退会運営拒否を含む。
local複数接続競合PASS。運営UI全フローとstaging同時対応は未検収。

## 12. Responsive
local匿名35チェック、認証済みprofile5幅（320/375/390/768/1280）PASS。
room/work詳細、modal、添付、通報/退会UIの認証済み完全検収と実スマートフォンは未実施。

## 13. P1
**未解決P1群3以上、0と証明できない。**
1. 退会のAuth FK/CASCADE/Storage保持・物理削除整合性。
2. 本番の広いRLS/GRANT/旧RPC/Storage境界（未反映で存続、今回は本番再監査なし）。
3. 既存公開作品/共同ログのPIIと保持・個別除去対応の完全検収不足。
旧Core復帰/同意欠落はstaging019で防御。Web必要権限不足・Core/退出ロック順/実UI未完は追加P2/公開阻害。
全リポジトリの最終攻撃経路監査を完了したとは主張しない。

## 14. Tests
今回成功 **855チェック**: offline697＋監査schema local39＋native競合31＋実staging45（Core12/退会前提7/schema26）＋Web8＋匿名responsive35。
39には旧019適用前の脆弱性再現1件を含む。再現成功は安全性PASSではなく、その後019で旧role権限拒否を別確認している。
Web8には機能失敗時の画面幅確認を含む。855は完全機能検収数ではない。
typecheck、対象lint、通信遮断build、git diff --check成功。Next middleware廃止予定警告あり。
主要ログ: final-staging-*.txt、core-staging-result.json、deletion-privacy-staging-result.json、staging-schema-integration-result.json、staging-web-result.json。
合成PG/Next/Chrome終了確認。秘密値は非公開Git除外領域のみ。
再実行: npm run staging:core / staging:privacy / staging:schema / staging:web。WebはMVP_TEST_RUNTIMEを要する。実syntheticデータを追加する。
staging:smokeは従来の基本接続検査であり完全suiteではない。

## 15. migration 001〜018
今回不変、既適用。019/020を追補。020の履歴hashは改行LF正規化、raw file hashは別途記録する。
本番bootstrapは禁止。005再実行で017の内部RPC剥奪を戻さない。既存job/重複pending/実schema差分のpreflight必須。
001〜020をそのまま本番へ適用可能とはまだ判定しない。

## 16. USER APPROVAL REQUIRED
保持/匿名名/未公開Creator拒否方針は今回採用済み、再承認不要。追加ローカル技術作業にも再承認不要。
必要な人手は実確認メールの受信、運営窓口/当番・法務/実機検収。技術未完了を承認待ちへ置き換えない。
本番反映承認は全ゲート合格後のみ。今は求めない。

## 17. Production rollout
未実行。preflight（schema/既存job/重複申請/依存）→バックアップ復元演習→Phase A互換追加→smoke→Phase B RPC/境界→承認済みapp→機能smoke→旧経路権限剥奪→最終smoke→監視。
旧危険Core経路を復活させるrollbackは禁止。flag停止＋前進修正を基本とする。DB/app/policyの対応版を揃える。
Auth削除・Storage物理削除はrollback不能。これらは保持検収後の最終工程。

## 18. Git状態
branch security/fix-storage-sign。既存大量差分・削除2件を保持。今回一覧はfinal-staging-change-inventory.json。
主変更: Core API/UI・ルーム作成設定・退会API/UI、019/020、staging検証scripts、next.config/tsconfig/.gitignore/package scripts、証跡・引継ぎ。
commit / push / deploy / merge / reset / clean / stashなし。本番変更なし。

## 19. 次にすること
最優先はclient最小権限と同意保存経路の設計/検証、その後退会保持FK/Storageと最終worker、退出競合原子化、残Web E2E・復旧/実機。
ユーザーへ本番反映承認を求められる段階には未達。AI_TASKはblocked、具体的な機能/整合性阻害を記録。



## 第46節: 最終仕上げの結果（2026-10-21、最新）
総合NO-GO。詳細はFINAL_FINISHING_ACCEPTANCE.md（指定18項目）。旧節の「client ACLで全Webが止まる」は解消。
021/022をstaging fwqucffxdmbdczspkcyrへ適用。本人profiles/membershipだけの読取、公開profile列限定、新mvp_room_list、本人同意RPC、公開draftの匿名読取を整備。旧view/DMLは開けていない。
実Webは作成/参加/同意/投稿/添付/既読/Core却下→再申請→承認/期限公開/作品/like/report/profile/logout/匿名添付bytesまで完走。認証後18＋通報3の幅検査PASS。タイマーhydrationを修正。
今回906チェック成功（offline697/local監査schema73/native31/staging63/Web42、再開重複除外）。弱点/失敗条件再現を含むため完成率とはしない。型・対象lint・通信遮断build・diff成功。
退会Auth削除は監査schemaでwrite fenceとCASCADEの衝突を再現。FK保持主体/専用cleanup/元UUID公開遮断/既存job補正が未実装。UI/API準備中とAuth保持を維持、最終worker未接続。ACCOUNT_DELETION_FINAL_GATES.md参照。
P1未解決3群以上（退会整合性、本番未反映の権限/旧経路、既存公開PII/保持検収）。本番反映承認を求められる状態ではない。
次: 匿名保持主体＋限定prepare→退会Storage→Auth/再送の実検証→残E2E/復旧/運営。技術作業の追加承認不要。人手は実メール・運営窓口/当番・法務/実機。
branch security/fix-storage-sign。既存全差分/削除2件保持。今回021/022/UI/検査/台帳/docs変更。本番アクセス/変更、commit/push/deploy/merge/reset/clean/stashなし。sources不変。
