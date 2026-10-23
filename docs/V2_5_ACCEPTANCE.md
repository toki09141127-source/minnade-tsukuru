# V2.5 acceptance

Status: COMPLETE — 2026-10-23 JST。staging / Hosted Previewの運営基盤として確定。本番公開の承認を意味しない。

## Scope / source
Branch develop/v2、worktree C:/dev/minnade/minnade-tsukuru-v2。開始b794e0e、実装79a15d706cbded925a552351a1c69bf6ecb03502。
Preview: https://minnade-tsukuru-staging-6jtg2klwo-sonetokiyas-projects.vercel.app
READY、上記source。以後の差分は検収scripts/docsのみ。
Supabase fwqucffxdmbdczspkcyr。Production Changes NONE / Live Billing OFF / 実OpenAI再送0。

## Verification
- 隔離PostgreSQL317 checks（既存V2.1〜V2.4 213、運営104）PASS。v2-5-regression-local-result.json。
- Billing unit32、既存MVP21 suites PASS。このタスク中の実行証跡を再利用し、変更のない検証を繰り返さない。
- staging metadata16 PASS。RLS、直接grant拒否、caller-only RPC、合成role、AI/退会worker OFF。v2-5-staging-metadata.json。
- local production build + 実staging UI22 PASS。v2-5-local-ui.json。
- Hosted管理画面22 PASS。v2-5-preview-ui.json。
- Hosted API + 実staging追加10 PASS。v2-5-preview-scenarios.json。
- Hosted 375px実ボタン操作5 PASS。v2-5-preview-mobile-actions.json。
- 合計424 check単位＋MVP21 suites。幅・axe内部検査数と秘密走査資産数は重複加算しない。
- 型検査、関連lint、実装build、Hosted build成功。実装commit後は検収scripts/docsのみで、追加script lintとgit diff --checkを実施。
- 全10管理領域を320/375/390/768/1024/1440幅で検査。axe違反0。dialog、Enter/Escape、focus復帰、確認前の送信無効を確認。
- Hosted通常操作のconsole/hydration/uncaught/5xx 0。意図したModerator403・取得失敗503は負例として区別。
- 配信HTML/JS26資産とrepo/client bundle105資産で既知秘密値混入0。v2-5-preview-secret-scan.json / v2-5-secret-scan.json。

## A〜P evidence
- A/B: Owner概要、Moderator限定表示、一般/suspended/未認証拒否。Hosted UI/API。
- C: Moderator reviewing→hide→resolved、内部noteと監査。Hosted UI。
- D: 停止中post/upload/join拒否、解除後に実join/upload/post成功。Hosted API + staging RPC。
- E: Moderator feature変更拒否、Owner停止/復旧。375pxでも投稿/アップロード停止・復旧成功。
- F: AI OFFでmanual503、人間投稿と期限後human fallback公開成功。実AI呼出0。
- G: upload OFFで新規拒否、既存公開添付は署名後に実画像を取得可能。
- H: 受付OFFで退会job追加0、worker pause維持。副作用checkpoint対pause競合は隔離DB。
- I: 合成past_due/graceの管理表示。Moderator Billing読み取りのみ、手動entitlement変更不可。
- J: hide/suspend/report/feature/roleのstaging監査あり。一般read/write拒否、監査・note改ざん拒否は隔離DB。
- K: Hosted同一版hide/restore競合。200と409、成功監査1件、状態復旧。
- L: 通報dismissed後もhidden維持。通報状態とコンテンツ状態を分離。
- M: work restore→匿名閲覧可能、hide→直接room/snapshot不可、運営詳細は閲覧可能。
- N: 公開log投稿hide→logと添付新規取得から消える。work snapshotは保持。restoreで復旧。
- O: Creator停止でも公開work保持、active room投稿拒否、解除後復旧。
- P: 隔離DBで許可済み書込終了までOFFが待機し、OFF確定後は新規書込拒否。AI CAS、利用停止・通報競合、退会checkpoint対pauseもPASS。

## Definition of Done
Admin Roles/Auth、Overview、Reports、Users、Rooms、Works、AI/Billing/System、Audit、Hide/Restore、Suspend/Restore、Feature Stops/Recovery、Account Deletion/AI/Billing Oversight、Audit Immutability、Permission Matrix、Security/Privacy/Concurrency、Responsive/Accessibility、V2.1〜V2.4/MVP Regression、Hosted Preview、Build: 全項目PASS。

## Fixtures / corrections
合成5名（Owner/Moderator/member/suspended/departing）、3ルーム、3通報。第三ルーム・画像も検収専用。実ユーザー/既存公開作品/productionデータは操作しない。
追加公開の期限だけを合成fixtureへ限定更新しhuman fallbackを検査。公開結果本文はログへ出さない。
初回の追加通報はhidden対象への新規受付を既存admissionが正しく拒否。公開中に受付→hide→dismissへテストだけ訂正した。
モバイル初回selectorを実ラベル「アップロード」へ修正し、未完了分だけ成功を確認。アプリ修正・新migrationなし。

## Cleanup
承認済みexact-host Cookieのみ、host-only/Secure/HttpOnly、ローカル有効期限最大2時間。値/headersはログ・docs・Gitへ保存せずProtection不変。
検収後Cookieファイル0、合成5名のrefresh session終了、有効auth.sessions/refresh token各0、browser/local server終了。短期access JWTの即時失効は主張しない。
V2.5ではWebhook転送/Stripe listener未起動。全停止設定は開始時と一致、AI OFF・退会受付OFF・worker OFF維持。合成fixture/immutable auditを再現用に保持。v2-5-cleanup.json。

## Known Issues / boundaries
- V2.2実OpenAI429は未解消・再送なし。V2.5 blockerではない。
- JWT発行時刻1時間以内のチェックは直近のpassword入力/MFAを証明しない。MFA/step-upは将来要件。
- 自由記述PII検出はheuristic。メモを必要最小限にし、個人情報を貼り付けない。
- 非表示は新規公開取得を止める。発行済み短期Storage URLや閲覧者のコピーを即時失効・回収したとは扱わない。
- 無人cronの実運用・Supabase管理Auth/SMTPログ・物理端末・screen reader認証は合格に含めない。
- Bufferはstaging未接続。本番Bufferは閲覧・変更しない。
- モバイル管理ナビは狭幅で折り返す。緊急操作は375pxで成功、縦長詳細の見やすさは改善余地。
- Buffer/V2の040採番衝突、production移行順・Owner bootstrap・停止復旧・live課金運用条件は別の統合検収で確定する。一括db pushは禁止。

## Next
V2全体の統合検収・本番移行準備へ進める。production migration/deploy/admin enable/main mergeは未実施。develop/v2へローカルcommit、pushなし。
