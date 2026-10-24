# Free V2 production release

2026-10-24 22:44 JST: production general writes OPEN. FREE V2 / HUMAN COLLABORATION FIRST. Production GO for human collaboration; Git main/tag finalization pending.

Approved release source: 6cb898f; frozen 213-file source hash 42465192f243d968c643972277ad9873390bebef543761b70fe76266c26cbef5. Production https://minnade-tsukuru.vercel.app ; deployment dpl_8DiUn6fztMFussje9XGAHgVRjbE5 READY.

Canonical 042-059 (18 migrations) applied in five checked phases. Earlier 38 hashes unchanged. Fresh encrypted DB/Auth/Storage backup and isolated restore: 18 migrations/106 checks plus two bounded auth/write-window suites of 11 each PASS. Managed service recovery and off-device/other-Windows-profile recovery remain unproven.

Production TEST smoke PASS: create/join/Core/text/image/highlight/draft/publication/log/public attachment/report/admin stop controls. Security PASS: foreign-room and direct privilege denial, hide/restore, all 22 new public + 4 private table boundaries. TEST retirement PASS: billing stop, Auth last, former login denied, public attribution anonymized, used bytes retained, unused object removed; other retirement jobs unchanged.

Owner compatibility incident: V2 bootstrap omitted moderation_operators membership required by the existing internal moderation function. Explicit two-target approval received; audited correction and rollback rehearsal passed. Production hide/restore passed. TEST Owner then deactivated and compatibility membership removed; all TEST sessions 0. Only designated real Owner remains active. No RLS/GRANT/RPC changes.

Existing data: 49 of 51 protected non-Auth table hashes unchanged after excluding the bounded TEST graph/approved Owner addition. Two explained changes: exactly one TEST retirement surrogate (excluding it restores prior hash), and deletion pause-control timestamp from tests. AI/Live Billing/synthetic AI OFF. Buffer send remains intentionally OFF; original scheduler ON and two cron jobs restored. Pricing is 準備中.

Production signup/reset email bodies saved and full-text verified in a fresh Dashboard tab. Only exact canonical RedirectTo uses the explicit confirmation screen; old body retained for other paths. Subjects/SMTP/PKCE/expiry unchanged. Actual final Android/iPhone email flows are NOT PASS and remain accepted Known Risks. No real OpenAI requests in this release.

First post-open monitor: HTTP/Auth 200, TEST bytes match, no stale retirement/effects/reports, no RLS gaps, no Vercel 5xx/runtime events. Hourly heartbeat v2-24 ACTIVE until 2026-10-25 22:45 JST, quiet on healthy unchanged runs. Depends on this Windows host/Codex; managed Auth/SMTP logs and physical email flows are not automatically monitored.

Rollback: do not blindly restore the old application against schema059 or reopen writes with old retirement behavior. Stop writes/deletion/cron and preserve unknown external effects first, then use the encrypted fresh backup/validated restore procedure or a forward fix. Old deployment dpl_6VQm4PuLyaqwdW9p7ZUXJzSCLDbB is retained. No data rollback performed.

Evidence: v2-free-launch-result.json, v2-free-production-migrations.json, v2-free-cutover-backup.json, v2-free-cutover-restore.json, v2-free-smoke-result.json, v2-free-security-result.json, v2-free-deletion-result.json, v2-free-test-cleanup.json, v2-free-resume-result.json, v2-free-monitor-latest.json.
