-- STAGING ONLY: fwqucffxdmbdczspkcyr. Synthetic acceptance account only.
-- Requested release verification: no raw token, password, identity or session is returned.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
WITH target AS (
 SELECT email_confirmed_at, confirmation_token, recovery_sent_at
 FROM auth.users
 WHERE email = 'minnadetsukuru.auth+staging1@gmail.com'
 LIMIT 2
)
SELECT jsonb_build_object(
 'readOnly', current_setting('transaction_read_only'),
 'matchingUsers', count(*),
 'emailConfirmed', bool_and(email_confirmed_at IS NOT NULL),
 'confirmationTokenCleared', bool_and(coalesce(confirmation_token, '') = ''),
 'recoveryRequested', bool_or(recovery_sent_at IS NOT NULL)
) AS audit
FROM target;
ROLLBACK;
