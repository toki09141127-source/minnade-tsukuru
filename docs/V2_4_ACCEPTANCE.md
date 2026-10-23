# V2.4 acceptance

Status: PARTIAL — final Hosted access approval/acceptance pending.
Scope: develop/v2, C:/dev/minnade/minnade-tsukuru-v2; staging fwqucffxdmbdczspkcyr; Stripe test sandbox verified by user and test API. Production Changes NONE. Live Billing OFF.

## Evidence already complete
- Isolated PostgreSQL: 213 checks, including V2.1/V2.2 regression, direct grant/RLS denial, billing ownership/retirement, Creator/Core, room snapshot/restore, credit concurrency/settlement, UTC month-end/leap day and inactivity timing.
- Offline billing: 31 tests, actual signature verification and provider-adapter fault injection. Invalid/live/stale signature, ownership, duplicate/current canonical state, renewal schedule, unknown outcomes and schedule partial-failure recovery.
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

## Hosted status and remaining acceptance
Final source Preview: https://minnade-tsukuru-staging-4wqvksxt4-sonetokiyas-projects.vercel.app — READY (Vercel build complete; Hosted acceptance not yet executed). Earlier 9sfb8v7a2 is superseded.
The final Preview access Cookie + real signed-test-webhook forwarding permission is pending. Old V2.3/other Preview approvals are not reused. No new access cookie has been acquired; protection settings unchanged.
Prepared scripts: preview-access (exact final URL), preview-listener (loopback relay injects authorized Cookie only into exact Preview; raw body/signature transient, never saved), preview-payment (Plus and Pro real test Checkout→signed webhook→usage/settings→cancel), browser --preview (24 UI checks), states --preview, preview-secrets.
Run only after exact approval: preview-access; preview-payment --preview; browser --preview; states --preview; preview-secrets. Finally delete exact v24-preview-access.json / v24-preview-access-headers.txt / v24-preview-login.html within .staging-private, stop relay/browser, and record actual results. Do not claim Hosted PASS from Vercel READY alone.
No production/live payment. No permanent externally reachable webhook endpoint configured; official CLI forwarding is a bounded acceptance transport. Ongoing test operations need the listener or a separately approved durable test endpoint.

## Honest limits
No real OpenAI calls: previous 429 remains V2.2 PARTIAL, not a V2.4 blocker. Synthetic AI validates routing/reservation/output behavior only; cannot measure real model cost or instruction adherence.
Test Clock advances Stripe billing; SQL boundary tests isolate wall-clock expiry. The actual payment failure/grace-entry and recovery are real test-provider events; grace expiry uses controlled local DB time fields.
No real Android/iPhone device or assistive-technology certification in V2.4. Automated Chromium widths/axe are separate evidence.
No production/live billing/tax/refund/retention legal decision, no main merge or production migration. Existing Buffer/V2 migration-number collision remains a future integration prerequisite.
Webhook acceptance uses official Stripe CLI forwarding with signatures; persistent webhook delivery, retries/alerts and live rollout are not claimed.
