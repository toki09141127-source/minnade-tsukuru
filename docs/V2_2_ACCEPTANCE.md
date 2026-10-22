# V2.2 acceptance — 2026-10-23 JST

## Verdict
**PARTIAL**. Implementation and synthetic acceptance passed. Real OpenAI acceptance did not pass: three attempted calls stopped with HTTP 429; the latest sanitized classification was unknown. The user is checking the API project limits/billing. Do not infer the exact cause, reset the call history, or retry continuously.

Production Changes: **NONE**. Branch develop/v2; worktree C:/dev/minnade/minnade-tsukuru-v2. Implementation commit 8090808. Staging fwqucffxdmbdczspkcyr only. No main merge, production deployment, production migration or Buffer checkout modification.

AI generation is held OFF at both the DB control and Preview environment. Existing human posts, drafts and publication remain available.

## Implemented and verified scope
- Independent AI identity, immutable assist/free/forbidden mode, forbidden zero tasks/calls.
- Greeting once, Creator/Core question/idea/organize/summarize/draft assistance; Member/outsider refusal at DB/API.
- One allowlisted context builder, hidden/deleted/excluded/PII filtering, same-room references, no Auth or moderation payload.
- Human-authored decisions, unresolved/action proposals, Highlight candidates, summary/history and explicit AI disclosure.
- Human-only post thresholds (5 then 15), Highlight threshold, inactivity cancellation, deadline and publication dedupe.
- Preview/edit/review of a draft proposal, append with version check; no autonomous replacement of human draft.
- Private task/usage data, bounded retries, timeout handling, per-user/per-room limits, epoch stop and lease checks.
- Snapshot AI reference and disclosure; hidden output withdrawal; human-only publication fallback during outage/OFF.
- UI loading/empty/error/stopped states, read-only Member display, mobile viewport layout.

These PASS statements describe the local DB/synthetic staging checks below, not successful real model generation or proof against every possible PII/injection phrase.

## Evidence and tests
- [Isolated PostgreSQL](v2-2-local-result.json): **144 PASS**, including V2.1's 81 checks and 63 AI checks. Temporary server stopped.
- [Offline unit/provider](v2-2-unit-result.json): **52 PASS**, zero network. Includes strict output/context validation, unknown/quota/rate 429 classification, timeout/refusal, and store:false/no-tools request.
- [Real staging UI/API with synthetic provider](v2-2-staging-result.json): **19 PASS**.
- [Real staging automatic/publication checks](v2-2-staging-automatic.json): **10 PASS**.
- Existing MVP regression: **21 suites PASS** (private local execution log; no user data).
- TypeScript: PASS. Related app/lib/script lint: 0 errors, 0 warnings.
- Local production build: PASS. The final Work return-link adjustment also passed the hosted build (READY for 8090808).
- [Secret scan](v2-2-secret-scan.json): exact staging private secret values absent from Git-eligible files and local client bundles; values never printed. This check does not prove absence of every unknown secret.
- Git diff/staged diff whitespace checks: PASS at implementation commit.

## A–M coverage
A: assist greeting + joining + five-post summary; C: Core success/Member denial; B: manual assistance and readable output; J: draft proposal and human acceptance — staging UI/API and automatic tests.
D: forbidden zero tasks; E/F: safety exclusions and cross-room context; G/H: human-only count and threshold dedupe — isolated DB plus staging paths.
I: deadline exactly once; K: provider outage and AI OFF human fallback; L: free inactivity cancelled by human return; M: concurrent bounded publication, AI disclosure and moderation — staging automatic checks.
Real provider versions of these paths remain incomplete. Hosted Preview validation has its own 19-check result; it verifies AI OFF and stored synthetic outputs, not new real generation.

## Concurrency and security
Concurrent greeting claims yield one task; same request key yields one task and finish is idempotent. Source changes, revoked role, feature OFF or hidden room discard an in-flight result. Draft accept is versioned and duplicate accept fails. Parallel publication creates one Work.
No AI write tools/admin actions exist. Public work/log exposure rechecks source eligibility. Policies are not replaced by trusting browser roles.

## Migration audit
[044–047 applied manifest](v2-2-staging-migrations.json) records byte hashes. Prior migrations were not edited.
Final staging metadata observation: five AI tables have RLS; authenticated cannot claim provider context; anon cannot request AI; v2_settings_immutable trigger enabled; v22_fixture_clock(uuid,text) removed.
046 fixes the staging safeupdate WHERE requirement. 047 shares the publication implementation while allowing exact fixture-room publication; no unrelated room was published during acceptance.
Existing Buffer/V2 migration version 040 collision remains a future merge concern; do not indiscriminately push both migration directories.

## Hosted Preview
[Deployment evidence](v2-2-preview-deployment.json).
Preview: https://minnade-tsukuru-staging-m85sazjk6-sonetokiyas-projects.vercel.app
Project: minnade-tsukuru-staging, scope sonetokiyas-projects; production target forbidden.
AI is OFF. No synthetic provider is enabled on Vercel. Source upload excludes docs, tests, migrations, env and fixture credentials.
Hosted build READY for commit 8090808. [Authenticated browser checks](v2-2-preview-browser.json): 9 PASS. [Hosted API/responsive checks](v2-2-preview-result.json): 19 PASS, including room creation, posts, reviewed human draft, AI OFF 503, anonymous 401, no new generation, 320/375/390/1280 summary/messages, Work and public log. [Deployed secret scan](v2-2-preview-secret-scan.json): 17 HTML/client script assets, zero exact private-secret hits.

The first automated attempt reached Vercel protection. After automatic review rejected a separate verification cookie, the user explicitly approved this exact Preview-only method. The approved cookie enabled the tests; protection settings remained unchanged. The temporary cookie/header/response files were deleted after browser shutdown. No approval is pending for the completed Preview tests. Real hosted generation remains unverified.

## Acceptance corrections
The first HTTP-only probe mistook a Vercel login response for app success; the test now checks application content and the approved session. A synthetic Creator already reached the unchanged three-rooms/hour cap; a different existing synthetic Creator with available capacity performed one creation test. OFF creates a skipped greeting audit task rather than zero tasks: the expectation was corrected to require skipped tasks and zero outputs. Neither rate policy nor production behavior was changed.

## Known limitations / next actions
1. User to finish API project limit/billing check. Then perform a bounded real-provider recovery test; do not label unknown HTTP 429 as a confirmed billing issue. The real test runner needs a fresh, explicitly bounded recovery plan because its previous greeting task failed and its cumulative five-call ceiling has only two calls left.
2. With real provider healthy, verify hosted greeting/manual/summary/draft and restore AI only intentionally. No production approval is implied.
3. Preview has no unattended scheduler; guarded scheduler code and explicitly driven staging tests passed. Scheduled delivery/cadence has not been accepted.
4. Mobile checks passed on localhost and hosted Preview at browser viewports 320/375/390/1280; V2.2 Android/iPhone physical-device checks not performed. iPhone is not a blocker under this request.
5. Existing home-page guidance still describes MVP supporter/invite/five-minute Core rules; V2 room UI uses Member/approved Core resignation. Reconcile the stage landing-page copy during V2.3; it does not change DB permissions.
6. Safety filtering is a bounded heuristic plus allowlist/authorization, not comprehensive semantic moderation. Provider retention is not eliminated by store:false. Content already sent cannot be recalled after a concurrent moderation action.

V2.3 UI work can build on the isolated implementation, but V2.2 must remain PARTIAL until the remaining real-provider/hosted acceptance is completed.