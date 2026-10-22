# V2.3 Creative Office acceptance

Status: COMPLETE (staging UI scope)
Branch: develop/v2
Worktree: C:/dev/minnade/minnade-tsukuru-v2
Base: 4f0410a
UI commit: fd8494e
Staging only: fwqucffxdmbdczspkcyr
Preview: https://minnade-tsukuru-staging-gogr4s5qk-sonetokiyas-projects.vercel.app
Preview source: fd8494e6c3a5dce656be6443b3aadef37f8b4927 / READY
Production Changes: NONE

## Definition of Done

- PASS Brand/Home: みんつく、つくりたい人、集合。、指定subcopy/philosophy、制作中と最近完成した作品、参加案内。
- PASS Rooms: 制作中のみ、検索/ジャンル/AI/新着/おすすめ/締切、定員/残り時間/参加状態。
- PASS Room/Production Log: 人間の制作を主に、desktop sidebar/mobile tabs、添付/投稿/検索/4filter/ハイライト/公開除外。管理操作は既存server認可を維持。
- PASS Member/Core: 明示同意、Core応募・Creator承認、Core編集・ハイライト、辞退承認、追放confirmationと再参加禁止。
- PASS AI Creator UI/Summary: AI表示、保存済み合成greeting/summary/messages、区分した見出し、長文・empty・loading・error、停止中も人間の制作を継続。
- PASS Completed Draft: 7blockの追加・編集・削除・上下移動、ジャンルtemplate、preview、レビュー同意、保存、409入力保持。
- PASS Works/Work/Public Log: 公開snapshotを鑑賞する画面、新着/人気、画像の既存認可、公開日/いいね、「この作品ができるまで」、編集できない公開ログ。
- PASS My Page: 活動中/公開済み/申請・通知/プロフィール設定、empty導線。退出後も公開作品の参加履歴を表示。
- PASS Create/Join: sections、AI3モード説明、期限/定員/AI変更不可の明示、参加前に一般公開範囲への同意。
- PASS Empty/Loading/Error: skeleton/status、再試行、ログ・一覧・AIのempty、アプリfallback。
- PASS Responsive: 320/375/390/768/1024/1440。Home/Rooms/Create/Room/Draft/Works/Work/Log/My Page/Profile/Login/AIを確認。横スクロールなし。
- PASS Accessibility: labels、focus-visible、skip link、native dialog cancel初期focus/Escape、keyboard操作、状態は文字でも表示。主要色4組4.5:1以上。Hosted axeは21画面状態＋読み込み済みlog4状態で違反0。
- PASS Performance: 追加runtime依存0、一覧18件（継続確認19件）、ログ30件cursor、300/350ms debounce、署名画像lazy/async。負荷試験やCore Web Vitalsの実利用計測をしたという意味ではない。
- PASS Security/V2.1/V2.2 regression: caller-scoped read、未認証/退会/actor scope、無権限Member403、公開snapshot、競合、AI stop、人間fallback、既存MVP回帰。実provider成功は含めない。
- PASS Hosted Preview E2E / build。

## Evidence and counts

Local verification: 300 checks PASS, plus existing MVP 21 suites PASS.

- v2-3-regression-local-result.json: 144 (isolated native PostgreSQL; V2.1 + V2.2). Server stopped.
- v2-3-regression-unit-result.json: 52 (offline AI provider/safety; real API calls 0).
- v2-3-unit-result.json: 25 (catalog/auth/row bounds/snapshot/error/contrast).
- v2-3-browser-result.json: 28 (staging synthetic users via local production build).
- v2-3-actions-result.json: 4 (create navigation, actual image upload at320px, Core resignation, kick).
- v2-3-visual-result.json: 38 (responsive/axe/editor/AI).
- v2-3-ai-ui-result.json: 4 (route mocks; long/loading/empty/error).
- v2-3-fallback-result.json: 5 (V2 flag OFF retains MVP navigation and rejects V2 catalog).
- Existing docs/run-security-checks.cjs: 21 offline suites. Private aggregate log v23-mvp-regression.log.

Hosted verification: 79 checks PASS.

- v2-3-preview-browser-result.json: 28. Anonymous discovery, password login with synthetic users, Member post/search, Core request/approval, direct unauthorized operation403, Creator highlight/exclusion/draft,409 input retention, stopped AI, My Page, keyboard dialog, six widths. No uncaught exception or unexpected500.
- v2-3-preview-actions-result.json: 4. New room form really transitions,320px16x16 synthetic PNG upload/decoded dimensions, Core resignation approval, actual auxiliary Member join/kick/rejoin refusal.
- v2-3-preview-visual-result.json: 38. Ten main pages, draft editor and stored AI,21 axe audits without violations.
- v2-3-preview-ai-ui-result.json: 4. Browser route mocks only, no provider call. Expected mocked503 is deliberately recorded, not a production failure.
- v2-3-preview-supplement-result.json: 5. Core highlight/save/AI-off, loaded room and public log at six widths and4 additional axe audits.
- v2-3-preview-secret-scan.json: deployed HTML/JS19 assets, existing server secret value hits0.
- v2-3-secret-scan.json: repository/client bundle scan, existing server secret value hits0; applied AI migration hashes unchanged.

Typecheck: PASS (tsc --noEmit --incremental false).
Related lint: PASS,0 errors/0 warnings, including scripts/ui.
Build: PASS, next production build; hosted build READY.
Diff: PASS. Package/lock and all migrations unchanged from4f0410a.

## Preview scenarios A–F

A: Anonymous Home/Rooms/Room/Works/Work/Public Log, publicly readable content only. Member-only logs remain gated.
B: Synthetic Member login/post/search/filter/Core request. Consent join is exercised with auxiliary synthetic Member; existing memberships are reused for repeatable scenarios.
C: Synthetic Creator creates room, approves Core, highlights/excludes, saves draft, confirms kick.
D: Synthetic Core changes highlight, saves draft, respects AI OFF, requests resignation followed by Creator approval.
E: Stored synthetic greeting/summary/messages plus browser-only synthetic response/loading/error. Real OpenAI is deliberately not retried.
F: Previously forced-published synthetic fixture is viewed through new Work → public log. The unchanged publication backend is rerun in isolated144-check regression; no staging clock/worker/migration manipulation added for UI acceptance.

## Screenshots and correction history

Screenshots are Git-ignored .staging-private/v23-preview-{page}-{320,375,390,1440}.png. Loaded room/log screenshots are replaced by supplement after waiting for actual articles. Home no longer captures loading skeleton as finished content.

Initial harness selector mismatch and dev HMR navigation interference were test defects, corrected and rerun against production build. A duplicate loading/error label was corrected in AI UI. Long draft sidebar alignment was corrected with explicit grid rows. A draft race intentionally returns409 and retains input. Expected denied401/403/409 and mock503 are not counted as unexplained failures.

## Boundaries and remaining work

- V2.3 COMPLETE applies to this UI and staging Preview. V2.2 remains PARTIAL: real OpenAI429 recovery/success unverified, no retry. AI DB control and Preview flag stay OFF.
- Other members' names/roles and Creator identity are displayed only where existing RPC projection authorizes them (Creator management). No RLS/DB permission broadening merely for UI. Other roles retain counts and their own role/actions; unspecified public role is not guessed.
- My Page notifications use existing Core requests (latest30), room resignation state and publication tab. No new push/read-state notification infrastructure.
- Signed image URLs keep existing authorization/signing; no new public image proxy. Lazy/async native images preserve this boundary.
- Synthetic accounts/content only. No actual Android/iPhone or screen-reader device certification; viewport/keyboard/axe testing is distinct.
- No new staging scheduler/forced-publication execution; previously accepted fixtures plus isolated regression are reused.
- Existing Buffer/V2 migration040 numbering conflict must be resolved before future merge; no bulk db push. Existing Next middleware deprecation is nonblocking and unrelated to this UI.
- Source-only Preview upload excludes docs/env/tests/private files. No main merge, production DB/migration/deploy, user data, push or Buffer checkout change.
- Next: V2.4 Free/Plus/Pro design and implementation may start on develop/v2 with separate authorization; production rollout and real-AI-based entitlements need their own acceptance.
