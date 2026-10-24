# Free V2 production boundary — implementation proposal

2026-10-24. Local implementation/testing explicitly approved by the user after the automatic review rejection. No production configuration or deployment.

The proposed local change to `lib/v2/server.ts` permits V2 only when V2_ENABLED=true and either the existing exact staging boundary holds, or all production conditions hold: exact project URL joedeuyrzimqyjapqpyh.supabase.co, VERCEL_ENV=production, V2_RELEASE_MODE=free, V2_SCHEMA_VERSION=58. Unknown/mismatched environments remain disabled. Merely setting V2_ENABLED does not open production.

The proposed local change to `lib/admin/server.ts` uses that boundary plus ADMIN_ENABLED=true. Existing verified Bearer identity, DB Owner/Moderator role, suspension/deletion checks, recent JWT, CSRF, rate limit, version checks and immutable audit remain mandatory. No role is granted by this change. No bootstrap runs at startup. Owner remains the previously selected user, not a synthetic test identity.

Billing retains an explicit exact-staging, non-production boundary; all production paid provider actions remain forbidden even with a test key or BILLING_ENABLED=true. AI rejects production/project at provider configuration. Synthetic AI never becomes a production fallback.

Required validation: all missing/wrong flags and project mismatches denied; production Free human gate permitted only with the complete configuration; admin disabled without its flag, unauthenticated and non-staff denied; AI/provider billing remain disabled; retirement independent of UI flag; old MVP and V2-schema failure cases. Staging browser regressions after a new Preview.

Automatic approval review initially rejected removal of the unconditional production guard from adminEnabled. The user subsequently explicitly approved this exact bounded local implementation and testing. It has now been implemented: 52 boundary checks PASS, with typecheck/lint/build PASS. Staging Owner bootstrap and Free retirement rehearsals each passed 6 checks and rolled back their rows. Production rollout, environment changes and role grants remain prohibited.

V2_SCHEMA_VERSION=58 is an operator-supplied foundation marker, not a query of the live schema. Release additionally requires consent migration 059 and matching application version 2026-10-24. All 18 pending production migrations 042–059 passed the isolated backup-clone rehearsal; none has been applied to production.
