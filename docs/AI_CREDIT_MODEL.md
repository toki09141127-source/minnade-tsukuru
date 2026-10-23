# AI credit model

V2.4 provisional configuration. No actual OpenAI cost calibration or real AI success is claimed.

## Ownership and periods
Credit belongs to the billing account of the room Creator. All Creator rooms share it; a Core request debits that Creator, never the Core. Free has 50, Plus 500 and Pro 2,000 per monthly window from private config.
Free resets at UTC calendar-month boundaries. Paid uses subscription anchor; annual billing contains monthly windows with the original UTC day/time, clamped for short months and leap day, returning to the original day afterward. DST/session timezone does not change it. No carry-over.
Paid upgrade tops up the existing window by max(granted,new allowance), keeping consumed/reserved. New paid anchor can create a new period after Free; this is explicit, not a transfer of old balance. Renewal is unique by account/period_start; duplicate events cannot add grants.
Grace retains existing allowance without new grants. After grace Free calendar allowance is used. A finished old grace term uses its last nonempty window. No negative balance.

## Configured costs and routing
question / summarize: 1, Free, cheap.
idea: 2, Free, cheap.
organize: 5, Free, cheap.
draft_assist: 20, Free, cheap.
minutes / long_log: 5, Plus, standard.
characters / worldbuilding: 10, Plus, standard.
premium_draft: 30, Plus, standard.
final_edit: 50, Pro, premium.
The DB class configuration is authoritative. API never accepts arbitrary cost/model/owner. Tier model names use AI_MODEL_CHEAP / AI_MODEL_STANDARD / AI_MODEL_PREMIUM with existing model fallback, separate from plan logic. All Pro tasks are not premium.

## Atomic accounting
Request uses existing room authorization/lock and Creator account/period lock. Reserve succeeds only when granted-consumed-reserved covers cost. Same request ID/class/content retries reuse the task; changed content/class conflicts. Final-credit two-request race allows exactly one.
Advanced class repricing occurs in the same transaction as request creation. No provider call begins without reservation.
Success consumes once. Failed, skipped, stuck, invalid output or lost lease releases once; an ambiguous provider response cannot produce a second debit. Ledger action uniqueness is task+action. A retry after terminal outcome does not silently charge/run again.
In-flight work settles against the original period even after upgrade/reset. Reservations do not migrate. System work has zero credit delta and is separately bounded by existing room daily/cooldown/deadline/dedupe controls.
Greeting, minimum automatic summary/deadline/publication and safety processing remain independent of manual balance. Exceeding a technical budget stops AI, not human posts/draft/publication fallback.

## Retention and monitoring
Keep pseudonymous billing/period/room/task references, deltas, manual/system reason and time. No raw prompt/provider response/token/card/email is stored in billing events or ledger. Existing AI usage recording remains available for future cost comparison; actual cost is unknown until API availability is restored.
Review pending reservations, stuck tasks, pending billing operations, webhook failures and grace transitions. Tests cover insufficient credit, final-slot races, same-ID retry, upgrade in flight, failure refunds, zero-cost automation, period boundaries and ledger invariants.
