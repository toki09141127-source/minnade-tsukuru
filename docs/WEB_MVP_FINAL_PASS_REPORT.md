# 公開前仕上げパス・最終報告（2026-10-21、第41節）

## 1. 現在の完成度
ローカルWeb MVP: 100%未達。検証されたローカル実装は増えたが、未実装/未検収項目が残るため工数ベースの%は算定しない。
本番Web MVP: 100%未達。本番状態を変更・再監査していないため%を推定しない。
18領域チェックリストでは計測設計のみ公開ゲートDONE。1/18をコード完成率と呼ばない。本番反映の承認だけを残した状態には未到達。

## 2. 今回完了したこと
- 実PostgreSQL17.10をアプリ依存から分離し、127.0.0.1限定の新規合成DBで複数接続を検証。
- 013: 期限切れ未使用uploadのclaim/lease/再試行とStorage worker候補。使用済み/退会中owner/成否不明を除外。
- 014: いいねの期待値/希望値/操作IDによる原子的処理とUI/API。
- 015: ルームとCreator参加の原子的作成、内容固定の再送とUI/API。
- 016: 運営一覧/対応/退会受付の共有DB rate limit。
- 017: 通報対象の認可、同actor/target重複抑止、旧receipt再試行。旧APIも対象を再取得して確認。
- 単独moderation画面とLikeButtonの認証切替/二重送信/失敗後再試行を修正。
- ルーム作成の入力ラベル、Core人数説明、暗号学的招待コード生成を改善。
- 全44 route、Supabase参照70ファイルを列挙。最終安全性・移行・将来仕様・退会停止条件を更新。

## 3. 解消したP1
ローカルで、通報APIが非公開投稿の閲覧資格を検証せず自動非表示処理へ渡せる経路を閉じた。
新017はAPIを経たservice経路でも対象・重複をDBで制約し、internal関数への直接EXECUTEを剥奪する。
本番には未反映。旧Triggerを用いた実攻撃成功や、本番P1解消を主張しない。

## 4. 残っているP1
0ではない。実DBの広いSELECT/DML/旧RPC/Storage権限、Auth削除時FK/CASCADE・イベント所有権、既存公開PII、実参加RPC/Triggerの互換性が残る。
FINAL_SECURITY_PASS.mdとACCOUNT_DELETION_COMPLETION_GATE.mdが最新の区分。

## 5. P2 / P3
今回、部分room作成/いいね競合/運営UI再送/連打/未使用添付清掃を改善。実Storage故障/Member45枠競合/申請重複/プロフィール複数表同期/未読取得上限は残る。
P3はラベル7箇所とCore人数表示を改善。旧資料の未実装表現は過去記録として残し最新節で補足。

## 6. Account deletion
job/lease/CAS/名義/書込停止/退避/Auth結果照合は実装済み。Auth実削除とStorage保持、イベント管理権限と過去作者の分離は未完成。
退会受付flagと実workerを有効化していない。消せないFKをルーム・イベント削除や無条件CASCADEで解消しない。needs_reviewの安全停止を維持。

## 7. Attachment ownership
001のuser/room/unused/期限/atomic bind/二重使用拒否を維持。実複数接続の同一投稿再送/別key再使用拒否も確認。
013はnever-usedのupload成功済み行のみ隔離清掃。旧pathを所有者推定でbackfillしない。実Storageは未検収。

## 8. RLS / GRANT / Service Role
候補001〜017はローカルのみ。公開署名の意図的未認証経路はcanonical投稿/room/公開状態/pathを確認。
Service Roleはサーバー操作に限定し、本人確認/ownership/member/roleを再確認。実RLSが未整備のまま一律authenticated clientへ置き換えない。
現行カタログとの最終差分照合、Storage Policy、旧RPCを含む検収は残る。

## 9. Moderation / report queue
実競合: 同時hide/no_action、同一ID、先行rollback、権限取消の両順序、運営退会、対象匿名退会、capability残留なし。
新規通報のprivate/hidden/deleted/left拒否、重複通報拒否、非表示後receipt再送、公開ログ審査を確認。
実当番/窓口/保存期限/異議処理・Supabase E2Eは未検収。

## 10. Privacy / PII
最小公開projectionと画像EXIF/XMP/IPTC除去を維持。通報者IDを運営一覧から除外。ソースの既知secret形式scanは検出0（envは読まない）。
動画/PDF本文、既存公開PII、正式保持/名義とAI provider条件は別確認。本人同意なしの生成AI学習利用をしない方針を維持。

## 11. Mobile / UX
ローカルブラウザでログイン空欄エラー、作品一覧の通信障害メッセージ/再読込を確認。
作成画面の入力ラベルを修正し、最終ビルドで6つの常時表示入力のアクセシブル名を確認（招待入力は条件付き）。
320px幅切替/実機/reader/ログイン後全主要画面は未検収。ブラウザAPIにviewport変更機能がなく、検証済みとしない。

## 12. Tests
最終オフライン全体648件 + 実PostgreSQL19件 = 667件成功。
型チェック、今回対象lint、通信遮断/ダミー設定build、git diff --check成功。
実19件には20接続100回のrate操作を含み、単一windowで30回許可・counter31で飽和を確認（103ms）。これはSupabaseのアプリ全体性能指標ではない。
初回native fixtureは「keep_name退会は投稿を更新しない」ため待機想定を修正、006依存005不足も修正。型checkとbuildの並行実行で.next生成型が入替えになったため、最後はbuild→tscを順次実行して成功。
ログ: mvp-final-pass-*.txt、real-concurrency-result.txt。新規ローカルサーバーは停止済み。

## 13. Stagingで未検証
実Auth削除/失効/メール、Storage owner/remove/retry、実Trigger/旧RPC、全RLS/GRANT、既存作品、承認/参加競合、実機、100人のアプリ全体負荷。
識別済みの別Supabase projectを持っていない。現在表示されていた本番projectは使用しなかった。

## 14. Production applyが必要
検収後にmigration001〜017、対応app、依存flag・最小運営登録、監視/backup/復旧。現時点で一括適用可能という意味ではない。
PRODUCTION_ROLLOUT_PLAN.mdを参照。013cleanup、Auth workerは自動接続しない。

## 15. USER APPROVAL REQUIRED
対象を確実に区別できるsynthetic専用stagingの指定、正式な保持/イベント権限移譲/窓口/当番/法務、検収完了後の本番反映。
安全に識別できる隔離環境での検証は今回許可済み。同じ許可を再要求しているのではなく、対象と運営判断が未確定。

## 16. Git状態
branch security/fix-storage-sign。既存差分・既存削除2件を保持。今回新たに既存ファイルを削除していない。
変更一覧: mvp-final-pass-changes.json、全状態mvp-final-pass-git-status.txt。
commit / push / deploy / merge / reset / clean / stash / branch変更なし。本番DB/Auth/Storage/設定変更・本番ユーザーデータ取得なし。

## 17. 次にユーザーがすること
1. 隔離stagingの対象と運営責任者/窓口を指定。
2. 退会後の過去作者保持とイベント管理移譲、保存期間を決定。
3. その条件で退会・参加・実Storageの残実装/検収を進める。
4. 実機/負荷/運営/規約の検収後に、最終レビューと本番反映承認。
本番反映だけの承認で完成する、と誤認できる状態にはしない。
