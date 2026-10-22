# 第49節の追加検収（2026-10-22）

退会8gateの既存検収に加え、027の永続pause/Storage・Auth前checkpoint/二重effect防止/再開をstagingで検証した。A〜FすべてPASS。実staging29チェック、local監査schema119（うち追加16）成功。最新正本は [PRODUCTION_PREFLIGHT](PRODUCTION_PREFLIGHT.md) と [DELETION_STOP_RECOVERY](DELETION_STOP_RECOVERY.md)。

Technical STAGING GO、Operational NO-GO、本番反映は未承認。窓口は確定済み。旧節の実装完了証跡は保持し、今回の追加586を旧921へ単純加算しない。


<details>
<summary>第48節以前の記録（最新判断は上記を優先）</summary>

# 最終P1検収（第47節）
2026-10-22。対象: staging fwqucffxdmbdczspkcyrと隔離ローカル。合成データのみ。本番未アクセス・未変更。

## 1. 最終公開判定
**STAGING GO / PRODUCTION NO-GO — PRODUCTION APPLY APPROVAL REQUIRED**。
今回の100人MVP技術範囲の既知Technical P1は0件。これは本番反映済み・実メール配送・人による法務確認済みという意味ではない。
本番適用前のschema差分/既存job/Storage legacy/停止境界/backup確認はrolloutの必須停止条件。未確認なら適用しない。

## 2. Account deletion
precondition / prepare / anonymization / FK / Storage / Auth / retry / idempotency: **8項目すべてPASS**。
ACCOUNT_DELETION_FINAL_GATES.md参照。最終削除と受付は別flag、既定false。検収用ローカルWebだけtrueにした。

## 3. Creator退会
未公開roomはDB/API/Webで409拒否。表示は「公開前のルームを削除してから退会してください」。
公開後はAuth削除まで完了し、room/work/投稿/添付が保持される。ログイン不能な個別匿名主体へ参照変更。作品を削除してFKを回避しない。

## 4. Core退会
制作中active Coreは拒否。Creatorによる降格後は完了、公開後CoreもWebから完了。
実申請→承認履歴のupdated_at Triggerとの衝突を発見し026で修正。role直接変更だけのテストを実RPC経由へ改善。

## 5. Member退会
実SDK削除完了、活動membership停止、匿名投稿/通報履歴保持。他人投稿は比較して不変。
イベント/参加者/決定/旧draft/公開前ノートの保持も監査schemaで検証。

## 6. Storage保持・削除
used/ever-boundは保持。hidden/deletedは未使用とみなさない。
台帳で未使用が確定した正規pathのみquarantine→Storage SDK remove→metadata不在確認→finish。
実削除故障注入でAuthを残し、再試行で完了。遅延uploadは025で拒否。
未知owner/legacy pathは安全停止。prefix一括削除、storage.objectsへの実SQL DELETEなし。

## 7. Auth削除
匿名化/FK/Storage証明後のみSDK delete。失敗時再試行、成功時明示404 user_not_found照合。
旧login/refresh拒否、旧JWTで同意/profile書込拒否。Auth/Storage削除後の自動復元はしない。

## 8. Web E2E
48項目PASS。login/consent/profile/create/join/upload/post/unread/Core拒否→再申請→承認/draft/期限公開/like/report/logout/匿名作品・添付まで完走。
未公開Creator/Core退会拒否、公開後の両者退会、退会後の作品・添付取得も実画面でPASS。
21項目は320/375/390幅の認証済み画面/通報フォームのlayout確認。実端末受信メールは人の確認項目。

## 9. Moderation UI
7項目PASS。非運営拒否、pending/滞留一覧、空理由拒否、退会済みCreator作品を監査付き非表示、対応後一覧除外、限定復旧、退会中運営者の既存session拒否。
初回テストの同意待機・重複fixture・selectラベル指定を修正し再実行成功。アプリ認可を緩めていない。
moderation-web-result.json / moderation-web-proof.png参照。

## 10. Technical P1
**残0件（今回検証したMVP範囲の既知課題）**。
解消: Auth CASCADE/write-freeze衝突、保持参照、unused cleanupとAuth順序、Core申請履歴Trigger衝突、最終worker未接続。
再監査: 他user/requestId/stateは採用しない。本人jobは認証＋RPCからのみ取得。Creator/Core制約はDB側。finalizeはsecret/flag/UUID/lease/receipt検証。private prepareはclient不可。foreign row更新はactor一致列に限定、任意pathは削除対象にしない。
完了後の旧UUIDは公開参照から除き、私的監査だけに保持。全攻撃不存在を保証する監査ではない。
旧020以前に手動でstageだけ進めたjobはreceipt不足で安全停止する。移行監査で個別補正し、通常新規jobと混同しない。

## 11. Production-unapplied security items
本番未反映の実行項目 **6件**（脆弱性CVE件数ではなく反映単位）:
1. RLS/role/GRANT/旧view・安全な公開projection。
2. 添付所有権台帳・投稿atomic化・署名/公開境界。
3. 旧join/Core停止と同意・人数・role原子化。
4. 認証/認可/rate/debug旧経路の停止。
5. 通報受付/運営限定権限/監査/滞留管理。
6. 退会023〜026と最終worker/feature flags。
本番の状態が変わったと推定しない。適用承認・実行・smokeが必要。

## 12. Operational / legal items
運用上の公開条件 **3件**: 実在窓口/当番・代理と再試行担当、保持/匿名名義/権利・異議対応の承認、実メール/端末確認。
既存公開本文のPII実態は未調査。0件と断定しない。RETENTION_AND_PII_ACCEPTANCE.mdの承認された管理環境内で審査し、危険な対象を限定非表示にする。本文を外部AIへ送らない。

## 13. migration
023→024→025→026をstagingへ個別適用成功。001〜022は不変。
023: 個別匿名主体/Auth FK保持。024: 限定prepare/Storage証明。025: 遅延upload/最終Auth guard。026: Core履歴timestamp互換。
依存/停止・復旧/本番順はPRODUCTION_ROLLOUT_PLAN.md。台帳は26 migration＋baseline=27履歴。適用済みSQLの再編集なし。
Auth/Storage削除後はdown不能。新しい追補で前進復旧し、旧危険権限を戻さない。

## 14. Tests
今回 **921項目PASS（再実行の重複除外）**:
offline708 + 監査schema PostgreSQL103 + 実多接続PostgreSQL31 + 実staging退会24 + Web48 + 運営Web7。
退会A〜Lを網羅。拒否・故障注入・修正前の弱点再現も含むため、件数を完成率にはしない。
型/対象lint/通信遮断build/git diff --check PASS。buildは既存middleware移行警告あり、成功。ローカルDB/Webテストサーバー停止済み。
証拠: deletion-p1-security-checks.txt / deletion-final-local-tests.txt / deletion-p1-concurrency.txt / deletion-final-staging-result.json / web-full-staging-result.json / moderation-web-result.json / deletion-p1-typecheck.txt / deletion-p1-lint.txt / deletion-p1-build.txt。

## 15. Production rollout
最終承認→対象/backup/既存状態照合→signup含む停止→001〜026を順次smoke→互換app→拒否/通常/運営smoke→退会を最後にenable→少人数から拡大。
SQLを都合よく切り分けてexpand/contractと偽らない。途中失敗は対象機能停止、job/履歴保持、前進修正。
受付後失敗は本人再送または認証運営POST /api/cron/account-deletion。同じ受付番号を使う。自動scheduleは追加していないため当番が滞留jobを確認する。

## 16. USER ACTION REQUIRED
1. 検収結果と本番反映手順を確認。
2. 実在窓口・当番/代理・保持/匿名名義/権利対応を確認。
3. 実メール受信と実端末の最小確認。
4. 以上を満たした後、本番反映の範囲と停止時間を承認（まだ実行しない）。

## 17. Git状態
security/fix-storage-sign。既存全差分/削除2件保持。
今回主な変更: migrations023〜026、accountDeletionPreparation、account/delete・cron/account-deletion、DeleteAccountButton、staging検査scripts、offline API検査、適用台帳・docs。
本番アクセス/変更、commit/push/deploy/merge/reset/clean/stashなし。sources不変。秘密値は出力していない。

## 18. 次にすること
このSTAGING GO報告を確認し、運営/法務・実メールの最低限を確定。その後に本番反映を承認する。
技術タスクはdone、production approval pending。本番適用自体や未知の既存データを承認なしに変更しない。

</details>
