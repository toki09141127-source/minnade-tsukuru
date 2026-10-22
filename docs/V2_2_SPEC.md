# V2.2 AI Creator specification

Scope: develop/v2, C:/dev/minnade/minnade-tsukuru-v2. Staging fwqucffxdmbdczspkcyr only. Production changes NONE.

## Identity and modes
A room_ai_creators row belongs to one room and has its own UUID. It is never an Auth user or room_members row. A forbidden room creates neither an identity nor any task. Existing room.ai_level remains immutable. No backfill silently enables AI in older rooms.

Assist organizes, summarizes and asks restrained questions; creative ideas require an explicit Creator/Core idea request. Free additionally allows a gentle idea prompt after inactivity. Human posts and AI outputs use separate tables.

## Context and safety
mvp_private.build_safe_ai_room_context is the only source builder. It returns allowlisted same-room title, concept, genre, deadline, at most 20 safe human post excerpts (700 characters each), and at most five safe text draft blocks (600 characters each). No names, Auth IDs, emails, object paths, signed URLs, moderation records or private workflow data are sent.

Hidden, deleted, public-log-excluded, PII, secrets and recognizable injection instructions are excluded. The server validates and rebuilds the context again and enforces a 24,000-character ceiling. Attachments contribute only a category, never binary content or an object URL. Large or unsafe contexts fail closed.

Highlight means an important candidate. Authoritative decisions are exact human text beginning with 決定: or 決定： from current Creator/Core. The model cannot write the decisions field. Other statements remain proposals requiring human review.

## Tasks and budgets
Tasks have pending/running/succeeded/failed/skipped/stuck states, immutable identity, a per-room dedupe key, a fresh lease, and source/epoch boundaries. A room has at most one running generation. Manual calls derive the actor from Auth; Member, outsiders and departing actors cannot invoke.

Default limits: six manual requests per actor/hour, 24 non-skipped tasks per room/day, 10-minute automatic cooldown, six-hour inactivity threshold. First five then every ten further human posts enqueue a summary. Every three highlight state changes enqueue one. A greeting, one deadline notice and one publication preparation task each have stable dedupe keys. AI outputs never affect human count or inactivity.

The provider has a 20-second HTTP timeout and 1,800 output-token ceiling. Only an explicit rate-limit rejection may retry once after two minutes. Unknown 429, quota, timeout, invalid output and ambiguous outcomes do not automatically re-generate. An expired 45-second lease is marked stuck by the scheduler.

DB feature stop increments an epoch and skips queued/running tasks. Finish rechecks feature epoch, room status, actor capability and complete context hash. A human returning during an inactivity generation cancels it. Existing accepted human content remains usable while AI is stopped.

## Provider
AiProvider isolates OpenAI Responses API and an offline synthetic implementation. Model selection is server configuration only; the current default is gpt-4.1-mini-2025-04-14. The synthetic provider is unavailable on Vercel. No tool calls, write tools, previous responses or external browsing are provided to the model.

Responses use strict JSON schema and store:false. The API's application-state storage switch is not a promise that all provider retention is disabled; provider abuse monitoring/retention policy still applies. See [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [model capability](https://developers.openai.com/api/docs/models/gpt-4.1-mini), and [data controls](https://developers.openai.com/api/docs/guides/your-data).

Raw prompts and provider responses are not logged. Manual request text is held privately only while needed for execution/retry and then cleared; its hash preserves request idempotency. Outputs are user-visible product content, not diagnostics. Usage retains trigger, actor type, bounded provider/model, outcome, timings and token counts.

## UI and editing
The room has AI summary and AI messages/history views. Every output is marked AI Creator / AI. Creator/Core can invoke question/idea/organize/summarize/draft assistance. Members can read only. Loading, stopped, failed and empty states do not imply failure of human creation.

A draft proposal is previewed and editable. Explicit human review appends a text block to the latest matching draft version. A stale version or reused proposal is rejected; unsaved input is retained. No model can silently update a draft.

Creator/Core and registered active moderation operators can hide an AI output. A bounded audit record stores the action; ordinary users cannot change it. Public AI assistance is also removed when its output is hidden or its sources cease being eligible.

## Publication
Generation happens outside the publication transaction. Snapshot insertion may freeze a reference to a completed, current, safe deadline/publication output and sets contains_ai_assistance. Human blocks remain unchanged. The referenced AI organization is rendered separately, allowing moderation to withdraw it later. Source posts must independently satisfy public publication review. Incomplete human work stays marked incomplete.

Failure, timeout, feature stop or absence of a valid AI output produces the V2.1 human-only fallback. The publication implementation is shared by the existing batch worker and a service-only bounded V2 room entrypoint for safe acceptance tests.

## Scheduling
Room creation and authenticated AI-state polling drain already queued work via Next after. /api/cron/ai is protected by the staging CRON_SECRET and schedules inactivity/deadline/publication tasks, expires stuck leases, and processes one task per invocation. /api/cron/publish may prepare one AI task and always continues to human publication.

A regular external scheduler must call the guarded endpoints in an operating environment. Hosted Preview is deployed without automatic Vercel crons: Preview does not provide proof of unattended scheduling. The staging E2E explicitly drives the same scheduler and uses removable clock controls for exact disposable fixture rooms. No production scheduler was modified.

## Migrations and rollback
044 identity/tasks/outputs, safe context, roles and leases.
045 moderation, draft source invalidation and public AI reference.
046 WHERE predicate for staging's safeupdate extension.
047 one shared publication implementation with a bounded V2 worker entrypoint.

Previously applied migrations are immutable. A pre-existing 040 version collision with the separate Buffer branch remains a future integration concern; do not run an indiscriminate cross-branch db push.

Operational rollback: disable AI_ENABLED, call the service-only v22_ai_control(false), and leave the additive schema and histories intact. Human flows and publication continue. Do not drop tables or erase usage to roll back. Application rollback to V2.1 requires retaining schema compatibility and the safe publication behavior; production rollout needs separate review.