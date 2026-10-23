# V2 Release Candidate acceptance

判定: **V2 RELEASE CANDIDATE COMPLETE**。本番公開可の宣言ではない。2026-10-24 JST。
機能追加を凍結し、以降は不具合・セキュリティ・release blocker修正のみ。

## Source / integration
- 開始 develop/v2 cfd91f3。最新remote main 402719b12a5c41f77656f3715e7bef5e87d6baa8を686121aで通常merge。V2→mainなし、履歴書換えなし。
- RC application source: 1523476c801ccbddabd5257714da6bc5a727c80d。以後の変更は検収スクリプト・証跡・文書のみ。型チェック・関連lintを再実行、build済みapplication sourceとの一致を確認。
- Hosted RC: https://minnade-tsukuru-staging-ouzrmgsei-sonetokiyas-projects.vercel.app
- PreviewのDBはfwqucffxdmbdczspkcyr、Stripe test、synthetic AI。Production Changes **NONE**。Live Billing **OFF**。実OpenAI呼出し0。
- release/v2-rc1 と v2-rc1 はRC固定用。本番release tagではない。最終commit/push結果はこの文書と同梱のgit履歴・最終報告を参照。

## Definition of Done
すべてPASS: main統合、migration衝突解消、canonical sequence、fresh DB、V2.1共同制作、V2.2 synthetic AI、V2.3 UI、V2.4 Stripe test、V2.5運営、退会、Buffer回帰、security、RLS、concurrency、MVP回帰、Hosted Preview、レスポンシブ、axe、build。

## Migration / fresh / restore
- 本番適用済み38ファイルの名前・番号・raw SHA256を維持。main001〜041を維持し、V2旧040〜055を042〜057に改番（SQL bytes不変）。追加058はV2の全参加者とcapacityに合わせたBuffer候補残席計算。
- 旧staging番号履歴を改ざんせず保持。canonicalを既存stagingへ二重適用していない。058のみexact target/hashを確認してstagingへ適用。
- v2-rc-fresh-result.json: 空の隔離PostgreSQL→監査済みbaseline→canonical58本→合成seed→**334 checks PASS**。migration履歴の重複拒否を含む。
- 合成backupを別DBへrestoreし、77表の件数、516構造定義、92 RLS policy、144 index、正規化ACLを照合。archiveとtemp clusterを削除、server停止。これは本番backup/restore実績ではない。
- pg_cron/pg_net/http/Vaultはlocalでは明示した通信不能contract fixture。managed extensionの新規インストールは未検収。実stagingのextension・最終同期HTTP scheduler・ACL・停止状態は別に確認。
- v2-rc-staging-metadata.json: **46 checks PASS**。canonical V2追加26表すべてRLS有効・anon/authenticated直接DML不可。Auth FKは既知allowlistのみ。

## Integrated A–U evidence
- A: RC専用example.invalidユーザーを管理APIで作成・確認済み相当にし、Hosted UIログイン。実SMTPによるsignup confirmationは今回対象外。
- B–E: Free Creatorの作成、参加同意、Member投稿・画像台帳、Core申請承認、log検索。highlight・public除外・Core権限とdraft conflictはfresh DB実SQLでも再確認。
- F–I: synthetic greeting/manual/summary/decisions/unresolved/next/draft assist、Creator credit共有、Core manual、Member拒否、cross-room拒否、AI forbidden、proposalの人間確認後accept。localとHosted各24 checks。
- J–K: AI OFFでも人間の作業と期限公開を継続、重複公開なし、Work→公開制作ログ。likeは既存MVP suiteとfresh統合のDB検査。
- L–P: Plus monthly/Pro yearlyの実Stripe test Checkout、署名Webhook、UI/DB/credit/settings、profile保持復元、room snapshot、upgrade/downgrade/cancel、失敗→3日grace→回復、yearly更新。payment12、lifecycle16、schedule7、Webhook security9 checks。
- Q–S/U: 運営22機能checksと全画面6幅/axe0（初回console分類のみ未確定だったため初回全体をPASS扱いしない）。focused10、追加8、mobile5、console2 checksで補完。停止/復旧・公開添付保持・非表示log・同時対応・監査・role制限を確認。
- T: 有料合成Creator1名の実staging退会。既存worker/adaptersを使用し、対象jobだけ処理。billing停止→使用済添付保持/未使用削除→名義匿名化/公開snapshot保持→Auth最後→password/refresh拒否。途中Storage/Auth失敗、競合lease、再実行を検査。**16記録checks PASS（再開時の一部重複を含む）**。別job変更0。受付/workerは元のOFFへ復元。

## Regression / concurrency
- 既存MVP **21 suites PASS**（添付、認証、プロフィール、ルーム、投稿、作品、like、通報、退会等）。Buffer planner47 + connection25 + route26 + native140 = **238 checks PASS**。
- AI unit52、billing unit32、RC provider境界8 PASS。test runの集計はv2-rc-regression-result.json。
- fresh334にfinal room/Core slot、重複Core申請、kick/leave vs post、draft CAS、重複forced publish、AI claim/finish/accept、final credit1件、Webhook duplicate/lease、admin hide/suspend/report race、feature stop lockを含む。
- deletion worker競合は実staging exact-job leaseでも確認。Hosted hide/restoreは200/409の1勝者、audit1件。
- Bufferはstaging/Previewで書込modeを拒否しdry-runのみ。scheduler/auto-sendはOFF、X投稿0。

## API authorization matrix (role scope)
- anonymous: public catalog/Work/審査済public log/価格。private log/draft/AI manual/billing self/admin書込は不可。
- user: 自分のprofile・billing状態/intent/AI profile。参加同意後にMember。bodyのactor/plan/creditだけで昇格しない。
- Member: 参加中roomの閲覧/投稿/添付/申請。highlight・draft編集・manual AI・他者kickは不可。
- Core: 当該roomのhighlight/draft/manual AI。Creatorのplan/creditを使用。membership管理・Creator専用設定は不可。
- Creator: 当該roomの設定/承認/kick/公開確認。paid設定は契約・room snapshot条件が必要。
- Moderator: report/限定非表示/suspend/監査読取。Owner専用flag/staff/room-control不可。運営roleはprivate制作roomへの参加権限を自動付与しない。
- Owner: 監査付きflag/staff/room controls。CSRF、再認証時刻、version、停止/退会状態、自己停止/最後のOwner保護を継続。
- worker: cron認証/署名/actor-bound intent/leaseを検証。public requestのactor値だけでservice処理を開始しない。
根拠: fresh DBのrole実行、Hosted auth/security/管理操作、既存MVP mocks。すべてのURL×role組合せをブラウザで総当たりしたとはしない。

## Service Role re-audit
v2-rc-service-role-inventory.jsonに全38箇所。mainの35から追加は以下3箇所だけ。RC統合fixによるservice権限の拡大0。
- lib/ai/worker.ts: private task claim/context/lease finish。ユーザーRPCはauthenticated、workerのみservice。claimがroom/context/権限/creditを再検証する。
- lib/billing/server.ts: 署名済test eventのcanonical provider状態・operation lease・退会前cancel。staging/test境界でfail closed。user intentはauth.uid()に束縛。
- lib/admin/server.ts: allowlisted event名のmetadata記録のみservice。管理のread/action本体はauthenticated RPC。
既存35はverified自分profile、room/member/Creator確認＋atomic RPC、添付台帳/sign、public審査、operator/cron/退会workerに分類。通常RLSで代替しやすい自分profile/既読・SSR集計は将来の縮小候補。今回大規模に権限経路を置き換えず、既存MVP testsで回帰確認。raw service clientをbrowserへ渡さない。

## Browser / accessibility / cleanup
- 320/375/390/768/1024/1440で検収。主要room/draft/pricing/AI/adminとdialogsのaxe A/AA違反0。モバイル操作は実Chromeのviewport検証であり物理端末証明ではない。
- unexpected console/hydration/uncaught/5xx 0。Moderator Owner-only拒否の403と、注入503は別分類。通常401 loop/broken redirectなし。
- Cookieはexact Preview hostのみSecure/HttpOnly・最大2h。値は非公開一時領域のみ。検収後削除、browser contexts終了、14合成アカウントのAuth sessions/refresh失効、保存token除去、test契約残存0（通常2顧客とtest clock2顧客）、forwarder停止。v2-rc-cleanup.json。
- secret scan: repo/client bundlesおよびHosted配信assetに実秘密一致0。production API/DB/Storage/Auth操作なし。

## Non-blocking known issues / next
実OpenAI429再送0、Android RC実機PENDING、iPhone Safari RC verification pending、live billing OFF。管理Auth/SMTPログは未収集。managed extension installと別端末restore未検収。
本番向け境界の別レビュー、実AI、物理端末、最新backupと隔離restore、本番移行リハーサル、Owner指定、価格/creditと法務/特商法・live Stripe準備が残る。詳細はV2_RC_KNOWN_ISSUES.md / V2_RC_PRODUCTION_ROLLOUT.md。
**V2本番移行前最終検収へ進める。本番反映は未承認・未実施。**
