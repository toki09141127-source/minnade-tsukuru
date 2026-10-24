BEGIN;
-- pg_net defaults expose queued Authorization headers to PUBLIC. Restrict its transport tables.
REVOKE ALL ON net.http_request_queue,net._http_response FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
