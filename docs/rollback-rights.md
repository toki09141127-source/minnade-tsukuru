# V2 stable fallback with withdrawal only

Candidate based on the exact current V2 fallback source. It adds back only the existing
holder-facing URL and its read / revoke API. It never renders the work and does not support
publishing, granting, previewing, creating rooms in V3, or identifying any other applicant.
It forwards the authenticated user token and relies on the existing database owner check.

This candidate is staging-only. Do not promote it. The acceptance sequence on a protected
named preview is: capture an active grant from a controlled V3 fixture; set only the publication
database switch off; change the test origin to this V2-only build; verify old V2 writes, no
V3 public body, and an authenticated active-to-revoked transition for the holder. Preserve
the completed record and unrelated grants. Close staging switches afterward. Ordinary DB
hard shutdown still stops this endpoint: preserving holder rights in a global database shutdown
requires separate design. The rollback plan must distinguish that shutdown from a V2 app
rollback with the publication switch off.
