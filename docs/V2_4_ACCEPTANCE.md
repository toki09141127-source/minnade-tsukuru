# V2.4 acceptance

Status: COMPLETE — final corrected Hosted acceptance PASS; bounded V2.4 staging / Stripe test-mode scope. Confirmed 2026-10-23 17:02 JST.
Scope: develop/v2, C:/dev/minnade/minnade-tsukuru-v2; staging fwqucffxdmbdczspkcyr; Stripe test sandbox verified by user and test API. Production Changes NONE. Live Billing OFF.

## Evidence already complete
- Isolated PostgreSQL: 213 checks, including V2.1/V2.2 regression, direct grant/RLS denial, billing ownership/retirement, Creator/Core, room snapshot/restore, credit concurrency/settlement, UTC month-end/leap day and inactivity timing.
- Offline billing: 32 tests after the schedule compatibility fix, actual signature verification and provider-adapter fault injection. Invalid/live/stale signature, ownership, duplicate/current canonical state, renewal schedule, unknown outcomes and schedule partial-failure recovery.
- Real Stripe test + real Supabase staging: 16 checks. Hosted Stripe Checkout browser completed with published test card; signed official CLI events activate Plus, paid Pro upgrade, shared credit and permissions, profile reuse, cancellation/resume, scheduled cycle change and restricted Portal.
- Real Stripe Test Clock: 11 checks. Actual renewal downgrade/cancellation, failed payment/grace/no fresh credits, paid retry, monthly→annual renewal, billing retirement/cancel confirmation, idempotency and retirement webhook quarantine. Auth deletion itself was intentionally not executed.
- Existing AI offline: 52 PASS; MVP security regression 21 suites PASS. Later production-build typecheck caught missing lazy-import references not exercised by those mocks; corrected and build rechecked.
- 048–052 staging application complete, exact-byte hashes in v2-4-staging-migrations.json, AI DB flag false.

## Local/UI completion
- Local UI: 24 PASS; Pricing month/year, keyboard selection, usage, profile edit/save, Creator settings, Core and Free restrictions, unauthorized API. Six widths 320/375/390/768/1024/1440; 10 loaded screen states axe violations 0. Screenshots visually inspected.
- Payment-state UI: 4 PASS (mock states), expired grace/past_due, unpaid and incomplete retain Portal/cancellation; pending operation blocks a different request after reload. These are UI mocks, not additional real Stripe payments.
- Collaboration UI regression: 28 PASS on latest V2 billing source: discovery, consent/join, Core approval, posting/search, highlight/exclusion, draft save and 409 input retention, AI OFF, My Page, six widths and dialog focus. No HTTP500 or uncaught errors.
- Read-only staging metadata: 22 PASS including all new table RLS/direct ACL, private helper EXECUTE denial, AI OFF, 040–052 applied-byte hashes. No user rows retrieved.
- Implementation 7f89628, recovery fix 5c37a32. Latest source build/typecheck/lint PASS; all applied migration bytes also match committed HEAD. CRLF whitespace attributes preserve audited SQL rather than rewriting it.

## Hosted acceptance and corrected source

Initial Preview: https://minnade-tsukuru-staging-4wqvksxt4-sonetokiyas-projects.vercel.app (source 5c37a32). Explicit access approval received and executed.
- Checkout 12 PASS: Plus monthly, Pro yearly, signed webhook activation, period/cycle/credits, settings lock, cancellation and return-page axe.
- UI 24 PASS: pricing, month/year, billing/current plan, profile/settings save, Creator/Core/Free boundaries, 320/375/390/768/1024/1440, 10 loaded states with axe 0. Initial test accidentally checked a navigation loading shell; URL/progress waiting fixed before PASS. No app UI fix was needed.
- Payment-state mock UI 4 PASS, collaboration browser 28 PASS, signed synthetic webhook security 9 PASS. Total initial Hosted checks 77; no claim that intentional negative webhook 400/503 tests are error-free traffic.
- Deployed HTML/JS 23 assets: secret hits 0. Initial environment verified staging ref, four active Stripe test prices and expected sandbox account. Protection unchanged.

P1 found by real Hosted Test Clock: creating a Stripe subscription schedule with both from_subscription and metadata is rejected. This regression had been added after the earlier real-provider tests; the old unit stub accepted the invalid combination. Old lifecycle PASS is not proof for that later code. [Stripe create contract](https://docs.stripe.com/api/subscription_schedules/create).

Fix efebbb4: create with from_subscription only; assign metadata while updating phases. After a partial failure, replay the same idempotency key and require the exact existing schedule ID before adopting an untagged schedule. Foreign requests remain denied. Unit 32 PASS, typecheck/lint/build PASS. Real Stripe Test Clock + fixed localhost build + actual staging: 16 PASS (v2-4-schedule-recovery-lifecycle.json), including same pending operation recovery, downgrade, profile retention/lock/restore, new versus existing room snapshots, payment failure/grace UI/recovery, yearly renewal and billing stop before Auth deletion. This result is LOCAL transport, not Hosted, even where inherited check labels contain Hosted. No Auth deletion was executed.

Corrected Preview: https://minnade-tsukuru-staging-8531792ul-sonetokiyas-projects.vercel.app — READY, source efebbb4, staging-only. The user explicitly approved this corrected latest host; a fresh exact-host Secure/HttpOnly Cookie was acquired with a two-hour client lifetime. No old-host access was reused. Latest deployment listing, app HTML/client staging URL, enabled test-only billing boundary, sandbox identity and four active test prices were reverified before mutations.

Final corrected Hosted evidence (31 checks):
- v2-4-preview-schedule.json: 7 PASS. Existing synthetic Plus monthly user resumed, upgraded through the UI to Pro after paid signed test webhook (2,000 credits), scheduled downgrade, replayed the same request without duplication, verified canonical schedule metadata, scheduled annual change without early activation, and cancelled while current Pro access remained. No new customer or test user created.
- v2-4-preview-ui.json: 24 PASS, six widths 320/375/390/768/1024/1440 and 10 loaded axe states with zero violations. App console errors, hydration, uncaught exceptions and HTTP5xx were zero; no auth loop/broken redirect. Seven deliberately blocked external console/resource messages are distinguished from app errors. Loaded 320px billing screenshot visually checked.
- v2-4-preview-secret-scan.json: 23 deployed HTML/JS assets, existing secret values and the temporary Cookie value found 0 times.
- v2-4-preview-settled.json: final READ ONLY/ROLLBACK verification: pending/uncertain operations 0, pending events 0, active lease false, Pro active/monthly, cancellation scheduled with next_plan=free, AI generation flag false.
- Seven signed official CLI events reached this host; five succeeded and two were retryable under concurrent lease contention. The final mapped account had 11 processed events and no pending event/operation. These counts are not represented as seven immediate HTTP200 responses.

A first targeted attempt stopped before submitting an upgrade because getByLabel exact matching included option text in the implicit label. Only the test selector was fixed to identify the unique plan/cycle combobox by known options. Its failed report is retained in v2-4-preview-schedule-first-attempt.json and superseded by the complete report. The final settlement assertion was also aligned with the existing cancellation representation next_plan=free; no application or DB change was needed.

The only application change since the original 77 Hosted checks is efebbb4's Stripe schedule adapter fix. Unchanged Checkout/security/DB/credit evidence is reused with its original URL/source; it is not relabelled as fresh corrected-Preview execution. Final-turn changes are test scripts and evidence/docs only. Relevant script lint and diff checks passed. Typecheck/build/unit32/MVP21-suite evidence remains applicable because runtime code, dependencies and migrations did not change.

## Scenario evidence A–O
- A Pricing: initial Hosted UI 24, monthly/yearly and six widths.
- B/C/D Plus/Pro/yearly: initial Hosted Checkout 12, real test payment/signature/credit/cycle/paid settings.
- E/F Cancel/upgrade: initial Hosted cancel; corrected real-provider local lifecycle 16; final corrected Hosted schedule/upgrade 7 PASS.
- G Downgrade: initial Hosted detected the bug, fixed local real-provider lifecycle and profile UI PASS; corrected Hosted schedule 7 PASS.
- H Payment failure: actual Stripe failed renewal/grace/recovery in corrected local lifecycle; initial Hosted expired-grace states are explicit UI mocks. Free transition timing is isolated DB evidence, not accelerated production time.
- I Creator/Core: prior real staging synthetic AI plus initial Hosted Core permissions; isolated DB verifies plan inheritance. No member pool billing.
- J Credits: isolated PostgreSQL reservation/settlement/failure release/concurrent last-credit/duplicate ledger checks, real staging synthetic AI settlement. Prior tests reused because no DB/credit logic changed.
- K Automatic AI: existing synthetic automatic scenarios and V2.4 system-ledger zero-credit invariant; no real OpenAI calls and Hosted AI stays OFF.
- L/M Snapshot/profile: corrected local real-provider lifecycle verifies old-room Pro retention/new-room Plus/Free, stored profile locked after downgrade and editable after upgrade; initial Hosted profile UI save PASS.
- N Retirement: corrected real test subscription cancellation, repeated preparation, Auth retained, late event quarantine. Full Hosted account deletion remains disabled deliberately; existing deletion integrity evidence reused.
- O Security: initial Hosted 9 signature/duplicate/out-of-order/stale/unknown/missing-map/auth checks, plus existing unit and DB concurrency evidence. No live event submitted.

## Cleanup and safety
Initial exact-host Cookie client lifetime capped at 2 hours, Secure/HttpOnly/host-only. Raw headers were handled in memory, no cookie values in terminal/docs/screenshots/logs/Git. Exact temporary cookie/HTML/header files removed. Browser contexts and Stripe/local relay processes closed. Four newly created synthetic users' refresh sessions revoked and temporary tokens removed from private fixture files; expired access JWTs are not falsely claimed server-revoked. Synthetic identities/minimal billing fixtures retained for repeatable test evidence, not physically deleted through account deletion. Final corrected Preview cleanup is complete: fresh Cookie removed, four reused synthetic users’ refresh sessions revoked, contexts/listeners/relay closed, matching test processes 0. No new synthetic users were created in this final turn. v2-4-preview-final-cleanup.json records the bounded cleanup; retained synthetic fixtures are not production accounts.
Production Changes NONE / Live Billing OFF / real OpenAI calls 0 / migrations unchanged / no push or main merge.

## Honest limits
No real OpenAI calls: previous 429 remains V2.2 PARTIAL, not a V2.4 blocker. Synthetic AI validates routing/reservation/output behavior only; cannot measure real model cost or instruction adherence.
Test Clock advances Stripe billing; SQL boundary tests isolate wall-clock expiry. The actual payment failure/grace-entry and recovery are real test-provider events; grace expiry uses controlled local DB time fields.
No real Android/iPhone device or assistive-technology certification in V2.4. Automated Chromium widths/axe are separate evidence.
No production/live billing/tax/refund/retention legal decision, no main merge or production migration. Existing Buffer/V2 migration-number collision remains a future integration prerequisite.
Webhook acceptance uses official Stripe CLI forwarding with signatures; persistent webhook delivery, retries/alerts and live rollout are not claimed.

## V2.5 handoff
V2.4 staging/test acceptance has no remaining blocker and V2.5 planning/implementation can start on develop/v2 under a separate task. V2.5 is not implemented or automatically registered by this acceptance. Production/live billing remains unauthorized and unvalidated. Preserve the V2.2 real OpenAI 429 issue (no retries), existing migration-number collision, and separate live delivery/tax/legal/real-device prerequisites. If V2.5 depends on real model execution or production release, those prerequisites must be resolved within its scope.
