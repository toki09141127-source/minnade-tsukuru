# Owner moderation bootstrap compatibility

Production release remains under maintenance. V2 admin Owner exists, but public.mvp_moderate still requires a matching moderation_operators row. The V2 UI is the only callable moderation route: legacy RPC EXECUTE is revoked from authenticated/service_role by migration055.

Proposed exact correction:
- Target 1: already-approved production Owner 820ed99a-286e-4f96-95da-a66988139415.
- Target 2: this release's one temporary synthetic TEST operator, resolved from encrypted v2-free-fixture.aes users[3]. No other test/real identity.
- Confirm active Owner/Auth/profile and no retirement or suspension.
- INSERT missing moderation_operators(user_id) only for these identities, with immutable admin_audit bootstrap entries in the same transaction.
- No RLS, GRANT, function, or API change. Legacy RPC remains uncallable directly.
- Recheck versioned TEST hide/restore, role denial and audit. Deactivate TEST Owner and remove its compatibility entry before reopening general writes; retain real Owner's entry.
- If an unexpected existing state occurs, ROLLBACK and stop.

2026-10-24: automatic approval review rejected execution because the earlier Owner grant authorization did not explicitly include this compatibility membership and temporary test target. No proposed write executed. USER APPROVAL REQUIRED for the exact two-target correction.

User explicitly approved both identities and TEST cleanup. Applied with atomic audit after rollback rehearsal. Production hide/restore PASS; temporary Owner inactive, compatibility row removed, sessions 0. Real designated Owner remains active. No RLS/GRANT/function changes.
