# V2.4 Billing specification

2026-10-23. develop/v2 only. Production Changes NONE; Live Billing OFF.
Staging project: fwqucffxdmbdczspkcyr. Production joedeuyrzimqyjapqpyh is rejected by the application and migration tooling.

## Product and prices
Free: ¥0, 50 credits/month. Plus: ¥780/month or ¥7,800/year, 500 credits/month. Pro: ¥1,980/month or ¥19,800/year, 2,000 credits/month.
All values are provisional and originate from mvp_private.billing_config. Stripe Price IDs are separate server environment configuration; adapter validates actual JPY amount, interval and active/test state before Checkout/change. Existing two products/four prices are reused.
Human collaboration remains Free: rooms up to 50, Creator/Core/Member, posts/images, log/highlights/search, draft/publication, likes and reports. No unlimited claim or trial.

## Payment boundary
PaymentProvider interface separates application from StripeTestProvider. Only sk_test credentials, livemode=false objects/events, exact staging Supabase and non-production Vercel environments are accepted. Keys and raw webhook/provider payloads never enter clients, repository or result documents.
Checkout session return is informational only. Bearer-authenticated callers can operate only the billing account determined by auth.uid(), not request body customer/user IDs or email.
Customer metadata contains a pseudonymous internal billing account UUID. No email-based linking. Public pricing RPC contains no customer metadata.

## State and authority
Signed raw-body Stripe events (five minute signature tolerance) are claimed under a per-account lease, then current customer/subscription/invoice/schedule is fetched from Stripe. Event arrival order is not access authority. Duplicate IDs/hash conflicts and unmapped customers fail closed.
Active requires paid latest invoice. A failed pending upgrade retains only the previously paid original price whose invoice line covers the current subscription term. Incomplete/unpaid does not grant a paid plan.
Same-cycle higher plan is immediate after confirmed payment with provider proration and pending_if_incomplete. Downgrade, cycle change and cancellation are scheduled for renewal. Resume releases scheduled changes/cancel-at-end. Lower/new-cycle features are not applied before renewal.
Payment failure: three days from first canonical failure observation; no fresh credit grant during grace. Expired grace computes Free lazily without cron. Recovery applies the paid canonical state and grants each credit period once.
Subscription operations persist UUID, input hash and selection. Pending operations survive reload and retry the same intent. Known precondition rejections release the pending fence. Unknown outcomes remain pending. Provider idempotency keys and a request-tagged schedule allow recovery between schedule creation and phase update. Another request cannot overwrite it.
Portal is restricted to payment methods/invoices; subscription update/cancellation is controlled by the application.

## Data and privileges
048: billing_accounts, billing_events (IDs/hash/status, no payload), billing_operations, ai_credit_periods, ai_credit_ledger, room_ai_entitlements, ai_profiles; private config.
049: task reservation/settlement, tier routing, customization and profiles.
050: billing retirement fence and exact retention FK allowance.
051: durable selected operation and precondition rejection.
052: UTC monthly window/month-end/leap-day handling and pre-dedupe inactivity timing.
All new public tables enable RLS and revoke direct anon/authenticated/service-role access. User RPCs derive current actor, consent and deletion state. Service-only RPCs are narrowly scoped by operation ID or webhook/deletion lease. Private helper EXECUTE is revoked. Public pricing is anon-readable; billing/profile state is own-account only, room billing is participant-scoped.
Migrations are additive and individually transactional, applied only by exact-staging guard. Applied bytes are immutable and stored in the manifest; no general supabase db push.

## Creator, room and settings
A Creator owns one shared credit pool across their rooms. Core uses that pool; their personal plan never raises a room capability. Member cannot request paid/manual AI or edit Creator settings.
Room creation snapshots capability, settings and optional saved profile. Verified upgrades promote active rooms. Downgrades preserve existing room capabilities/settings until the existing maximum two-week expiry; new rooms use the current Creator plan. Retained capabilities do not create extra credits.
Plus: name/icon/personality/style, one specialty, three activity levels.
Pro: detailed profile, up to five specialties, five sliders, speaking controls, inactivity/deadline/ideas/summary/final-edit preferences and bounded custom instruction. Up to five reusable profiles, version-checked edits. Profile selection is copied atomically during room creation.
Downgrade locks paid editing/reuse without deleting settings. Resubscribe unlocks retained settings. Core cannot edit. Inactivity timing is checked before consuming a dedupe key; disabling reminders never suppresses minimum publication assistance.
Preferences are validated and supplied as untrusted data separate from immutable safety instructions. Heuristic text checks supplement, not replace, existing context/output authorization and PII filters.

## Retirement
Existing deletion workflow/pauses and published attribution policy remain. A deletion job fences new billing/AI writes. Before Auth deletion, a lease-bound worker expires open test Checkouts, cancels subscriptions without new invoice/proration, re-reads canonical stopped state and confirms billing retirement. Failures retain a resumable job; Auth deletion is blocked.
Webhook during retirement cancels any remaining provider activity and quarantines state rather than reactivating. Auth BEFORE DELETE also requires confirmation and no in-flight operations. Profile settings are deleted at retirement; minimal account/event/credit references remain with nullable owner_id ON DELETE SET NULL. Existing deletion verification allows only the exact new known FK and keeps unknown dependencies blocked.
Live billing retention periods, tax records, event ownership and existing deletion policy require separate production approval. Staging test verifies the billing preparation without unpausing/deleting Auth.

## Operation and rollback
Disable BILLING_ENABLED to stop new provider actions; retain signed-event processing until pending provider outcomes are reconciled in any future production rollout. Current implementation is test-only and uses the same flag for webhook processing; therefore do not stop a test listener or flag while a test operation is in flight. Resolve pending operations before shutdown.
AI_ENABLED and private ai_control remain OFF outside bounded synthetic acceptance. No real OpenAI retry (known 429).
Rollback is flag-based/fail-closed; retain tables, event/credit ledger and applied migration bytes. Do not drop billing state, rewrite applied SQL, or restore balances by hand. Reconcile provider state before any future re-enable. Native DB deadlock/lease conflicts roll back and require same-intent retry.
Hosted deployment keeps Deployment Protection. Real test webhook forwarding during acceptance uses the official Stripe CLI and authorized per-Preview access; this is a bounded verification transport, not a permanently registered live webhook.

## Production prerequisites (not decided here)
Confirm Japanese price/tax display, tax_behavior, payment/provision timing, automatic renewal, cancellation/refund policy, commercial disclosure/contact and record retention with the operator/adviser. Do not treat provisional copy as final legal terms.
Actual model cost/quality is unmeasured; select tier model names and review allowances before live launch. A durable public webhook delivery/retry/monitoring path, live credentials/products, live security review, real devices and production migration reconciliation are separately required.
Official references: [Webhook signatures and delivery](https://docs.stripe.com/webhooks), [pending upgrades](https://docs.stripe.com/billing/subscriptions/pending-updates), [scheduled changes](https://docs.stripe.com/billing/subscriptions/subscription-schedules), [Test Clocks](https://docs.stripe.com/api/test_clocks).
