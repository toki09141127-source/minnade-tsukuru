# V2.5 acceptance

Status: PARTIAL — Hosted Previewは未検収。

## Scope
Branch develop/v2, worktree minnade-tsukuru-v2. 開始 b794e0e。
Production Changes NONE. Live Billing OFF. 実OpenAI再送0、429 Known Issue。

## Verified
- 053/054/055 staging適用、hash固定。v2-5-staging-migrations.json。
- 隔離PostgreSQL317 checks PASS（既存V2.1〜V2.4 213 + 運営104）。権限/監査/冪等性/競合/停止/復旧/退会capability。
- staging RLS/ACL/環境境界/AI OFF/worker OFF維持16 PASS。
- ローカルbuild + 実staging UI22 PASS。Owner/Moderator/一般/suspended、9領域+staff、hide/restore、通報、suspend/restore、global stop/recovery、role grant/revoke、CSRF、機密投影、空/取得失敗。
- 320/375/390/768/1024/1440、axe0。モバイル一覧カード。正常画面でuncaught/hydration/5xxなし。意図的な権限拒否403と取得失敗503は負例として別計数。
- MVP21 suites、billing unit32、型、対象lint、build、diff PASS。
- 秘密走査960ファイル・105client assets、既知secret value hit0。適用済みmigrationhash不変。
- Previewのstaging DB/test Stripe/AI OFF/worker OFF/ADMIN_ENABLED照合済み。秘密変数は検証済みstaging設定からpreview限定へ明示設定し、取得結果で値の一致を確認したとは扱わない。

## Fixtures
staging合成5名・2ルーム・2通報。Owner/Moderator/member/suspended/departing。既存公開作品と実ユーザーは操作しない。テスト公開snapshot、非表示、AI失敗metadata、grace、退会requestedの状態を用意。意図的OFF状態は維持。

## Pending
Hosted exact-host保護Cookie、Hosted全DoD、終了時のsession/cookie/プロセスcleanup、最終判定。
