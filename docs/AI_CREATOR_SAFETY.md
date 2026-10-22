# AI Creator safety boundaries

- Scope is explicitly staging; the V2 server gate requires the exact staging Supabase URL and V2_ENABLED.
- AI is not an Auth user, has no membership, and is never given a privileged tool.
- Client roles cannot directly SELECT/INSERT/UPDATE AI identity, tasks, output, usage or audit tables. RLS is enabled, privileges are revoked, and only narrow SECURITY DEFINER RPCs expose authorized actions.
- Actor identity comes from auth.uid(); no client-supplied actor/role decides manual invocation or adoption.
- The single context builder and a second TypeScript validator exclude unsafe sources and unknown fields. Prompt injection detection is a conservative heuristic; architectural isolation, no tools, role checks and output validation are the enforceable boundary.
- Model decisions cannot become authoritative decisions. Important facts still need human review; automated checks cannot prove semantic correctness of arbitrary prose.
- Output references must be same-room eligible sources. Both TypeScript and PostgreSQL validate nested output structure and text.
- Source revisions and exact context hash prevent stale in-flight output from being published. Deleted/hidden/excluded source changes invalidate old AI views.
- Global stop, published/hidden/deleted room state, role loss and withdrawal are checked again on completion.
- A source selection check occurs before a network call; it cannot undo bytes already transmitted if moderation changes concurrently. The result is discarded if the source changes. Provider retention follows provider policy, not a promise of instantaneous deletion.
- Provider secrets remain in ignored staging environment files and Vercel encrypted Secret variables. No browser bundle imports provider or service-key code. AI configuration is not NEXT_PUBLIC.
- Raw provider errors and prompts are not retained. Logs contain known error classifications and aggregate token/timing data only.
- Unknown 429 and quota failures stop automatic retries. Real acceptance has a persistent five-call cap and uses synthetic text only.
- AI moderation is auditable and limited to hiding an output; AI itself cannot invoke it.
- The fixture clock function exists only during staging acceptance, validates exact synthetic room IDs and is removed afterwards.
- Staging public AI rendering additionally requires reviewed public source posts; private room AI reads require active membership.
- No production DB, production user data, production secret or Buffer/X code is part of this change.

Known operational limits: public reuse of pre-existing accepted draft text retains the existing V2 publication review responsibility; heuristics can miss unknown personal information, so users must never enter secrets. An unattended scheduler and real provider availability are independent release checks. Mobile viewport checks do not equal physical-device verification.