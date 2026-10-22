# 隔離staging検収手順（第42節）
2026-10-21。未実行項目をPASSにしない。現在は USER APPROVAL REQUIRED: staging project identification。

## 環境識別
acceptance-environment.json: repoにsupabase/config.tomlと.temp/project-refなし、PATHにCLIなし。.env.localは存在するがキー名のみ記録、値は非表示。staging専用設定を確認できなかった。表示中のjoedeuyrzimqyjapqpyhをstagingと推測しない。
許可される対象は別project ref、別Auth、別Storage、test accountsのみ、productionコピーなしを責任者が確認した環境。refだけ違っても無人/合成専用の証明にはならない。外部メール/課金/通知をtest宛へ限定する。
安全に識別したsynthetic環境での検収は既にユーザーから許可済み。同じ抽象的承認を再要求しない。対象/予算/fixture/適用manifest確定が先。

## 実行前manifest
project ref、project名、責任者、合成専用確認日、Auth/Storage分離、DB version、既存migration履歴、各SQL SHA256、既存Trigger/関数/ACL定義の保存場所を記入。秘密値は含めない。
ローカルfixtureは最小モデルであり実Supabase schemaの完全複製ではない。実環境のschemaのみを許可された管理経路で取得し、ユーザー行/作品本文はコピーしない。baselineに同名新規objectがあれば停止。
001〜018を番号順に、各ファイル完了後smoke。005の旧definer一括変更は全署名を先に確認。009適用前job0件。既存jobがあれば消さず別移行計画。

## テストIDと必須証拠
各ケースに結果 PASS/FAIL/BLOCKED、実行時刻、migration hash、匿名化したtest actor別名、HTTP status、期待件数と実件数を記録。JWT/email/本文/署名URLを証跡に載せない。
- AUTH-01: signup→確認前拒否→testメール確認→login→logout。再設定/期限切れ/refresh/権限取消/複数session/スマホ復帰。削除済みuserの再login拒否と古いJWTの書込拒否。削除は保持検収完了後のみ。
- STORAGE-01: upload→台帳→post→署名。owner/同room他人/別room/left/kick/hidden/deleted/expired/used/未認証を分ける。MIME偽装/拡張子不一致/4MB超/EXIF合成画像。直接Storage APIでも迂回不可。
- STORAGE-02: 013清掃1件claim、remove成功後DB失敗、応答喪失、再claim。公開/共同/used/legacy/owner退会中は保持。予約/failedの遅延uploadは自動消去不可。新署名拒否と既発行URLのTTLを区別。
- SQL-01: anon/auth/serviceでtable権限と列権限、invoker views4件のprojection/人数、公開log審査、旧RPC/internal/helper呼出拒否。definer owner/search_pathを照合。API本人IDと任意body actorを混同しない。
- TRIGGER-01: membership/room create/like/post/退会/公開/通報の各実Triggerを有効なまま検査。故障注入はsynthetic対象限定。INSERT途中失敗、監査失敗、COMMIT後HTTP応答喪失。外部Storage/AuthはDBと原子的でない。
- JOIN-01: Member44人→別user同時join→成功1、満員1、45人。重複join1行、kick再join両方拒否。018実PostgreSQL合成済みだが実REST/既存Triggerを確認。
- CORE-01: Core3人→pending2件をCreatorが並行承認→昇格1、CORE_FULL1、Core4。申請状態と同意保存も同じtransactionでなければFAIL。現行approve_core_request本文は未照合、API後置同意UPDATEが残るため検収前修正要。直接人数Trigger検査だけでPASSにしない。
- PUBLISH-01: 期限前/期限到達/hidden/deleted/already published/finalなし/draftなし/空draft、cron並行と再送、途中Trigger失敗→retry。roomごとdraft1件、公開状態と本文固定の一致。100件batchを超えた場合の残件/再実行も確認。
- MOD-01: 運営A/B同時、取消が先/後、退会するreporter/target、stale UI/duplicate report/hidden target。ローカルで31件中の競合を検査済み。stagingは実TriggerとREST/JWT/運営UIの差だけ重点実施。
- DELETE-01: ACCOUNT_DELETION_FINAL_DESIGN.mdの全保持・FK・Storage・session条件。途中失敗ごとworker再開、Auth削除後の記録復旧。needs_reviewは自動解除しない。
- PRODUCT-01: 作成→同意参加→投稿→添付→期限公開→作品→いいね→通報→運営処理。非参加/退出/退会actorで同じURL/API直呼びも確認。

## 実機・responsive
local responsive-smoke.cjsはChrome headless、320/375/390/768/1280、未認証7画面のみ。結果JSONを参照。
stagingでboard/長い日本語・URL/file名/upload modal/report modal/profile/deletion状態を各幅で実行。横overflow、画面外ボタン、ソフトキーボード、Tab/Escape/focus復帰、reader、再認証後古い画面を確認。
USER APPROVAL REQUIRED: 実機担当のiPhone Safari/Android Chrome検収（運営検収担当の決定に集約）。幅エミュレーションで実機PASSにしない。

## 小規模負荷（未実行）
test users最大100、最初は5並列・60秒、問題なしなら20並列・最大5分。requests/sec上限10、upload2並列まで。500/認可異常/duplicate/想定外課金で即停止。production禁止。
room read/list/unread/like/report/sign/join/postを別batch。fixture total件数をREST返却上限以上にしてunreadの欠落も検査。p50/p95/error/429/重複/DB CPU/Storage転送を記録。
暫定合格値: read p95<1秒、write p95<2秒、予期しない5xx<1%、認可違反/重複/上限超過0。これは容量保証ではない。rate上限に達した429は設計値と照合。
ローカル100rate操作はこの試験の代替にならない。

## 後片付け
今回作成したfixture manifestのIDだけを対象に、保持/署名失効の検収後に整理。project全削除・production由来データへの操作は禁止。staging結果承認はproduction反映承認ではない。
