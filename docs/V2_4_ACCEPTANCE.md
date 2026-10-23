# V2.4 acceptance

Status: PARTIAL — original Hosted acceptance executed; Stripe schedule bug fixed; corrected Preview READY, exact-host access approval and targeted regression pending.
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

Corrected Preview: https://minnade-tsukuru-staging-8531792ul-sonetokiyas-projects.vercel.app — READY, source efebbb4, staging-only, existing environment unchanged. **USER APPROVAL REQUIRED:** new exact-host Cookie acquisition/use and signed test webhook forwarding. The user's permission was limited to the then-current Preview and forbade reuse on another Preview. Old access was not reused. Approval question sent after the corrected deployment became concrete.

Prepared next step: after approval, update the exact URL guard in preview-scope.cjs, obtain new access, run preview-schedule --preview with existing synthetic paid users (no extra user needed), browser --preview with app console/hydration/auth-loop metrics, final secret scan and cleanup. Recheck latest environment before any test mutation. The one runtime source change is Stripe schedule construction; prior unchanged UI/security/DB evidence is retained with its actual source/URL.

## Scenario evidence A–O
- A Pricing: initial Hosted UI 24, monthly/yearly and six widths.
- B/C/D Plus/Pro/yearly: initial Hosted Checkout 12, real test payment/signature/credit/cycle/paid settings.
- E/F Cancel/upgrade: initial Hosted cancel; corrected real-provider local lifecycle 16; final corrected Hosted schedule/upgrade regression pending.
- G Downgrade: initial Hosted detected the bug, fixed local real-provider lifecycle and profile UI PASS; corrected Hosted pending.
- H Payment failure: actual Stripe failed renewal/grace/recovery in corrected local lifecycle; initial Hosted expired-grace states are explicit UI mocks. Free transition timing is isolated DB evidence, not accelerated production time.
- I Creator/Core: prior real staging synthetic AI plus initial Hosted Core permissions; isolated DB verifies plan inheritance. No member pool billing.
- J Credits: isolated PostgreSQL reservation/settlement/failure release/concurrent last-credit/duplicate ledger checks, real staging synthetic AI settlement. Prior tests reused because no DB/credit logic changed.
- K Automatic AI: existing synthetic automatic scenarios and V2.4 system-ledger zero-credit invariant; no real OpenAI calls and Hosted AI stays OFF.
- L/M Snapshot/profile: corrected local real-provider lifecycle verifies old-room Pro retention/new-room Plus/Free, stored profile locked after downgrade and editable after upgrade; initial Hosted profile UI save PASS.
- N Retirement: corrected real test subscription cancellation, repeated preparation, Auth retained, late event quarantine. Full Hosted account deletion remains disabled deliberately; existing deletion integrity evidence reused.
- O Security: initial Hosted 9 signature/duplicate/out-of-order/stale/unknown/missing-map/auth checks, plus existing unit and DB concurrency evidence. No live event submitted.

## Cleanup and safety
Initial exact-host Cookie client lifetime capped at 2 hours, Secure/HttpOnly/host-only. Raw headers were handled in memory, no cookie values in terminal/docs/screenshots/logs/Git. Exact temporary cookie/HTML/header files removed. Browser contexts and Stripe/local relay processes closed. Four newly created synthetic users' refresh sessions revoked and temporary tokens removed from private fixture files; expired access JWTs are not falsely claimed server-revoked. Synthetic identities/minimal billing fixtures retained for repeatable test evidence, not physically deleted through account deletion. New Preview access has not yet been acquired.
Production Changes NONE / Live Billing OFF / real OpenAI calls 0 / migrations unchanged / no push or main merge.

## Honest limits
No real OpenAI calls: previous 429 remains V2.2 PARTIAL, not a V2.4 blocker. Synthetic AI validates routing/reservation/output behavior only; cannot measure real model cost or instruction adherence.
Test Clock advances Stripe billing; SQL boundary tests isolate wall-clock expiry. The actual payment failure/grace-entry and recovery are real test-provider events; grace expiry uses controlled local DB time fields.
No real Android/iPhone device or assistive-technology certification in V2.4. Automated Chromium widths/axe are separate evidence.
No production/live billing/tax/refund/retention legal decision, no main merge or production migration. Existing Buffer/V2 migration-number collision remains a future integration prerequisite.
Webhook acceptance uses official Stripe CLI forwarding with signatures; persistent webhook delivery, retries/alerts and live rollout are not claimed.
