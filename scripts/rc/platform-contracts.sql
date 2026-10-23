-- ISOLATED LOCAL POSTGRES ONLY. Network functions fail closed; these are not managed extensions.
CREATE SCHEMA extensions;
CREATE SCHEMA vault;
CREATE SCHEMA net;
CREATE SCHEMA cron;
CREATE TYPE extensions.http_header AS (field text,value text);
CREATE TYPE extensions.http_request AS (method text,uri text,headers extensions.http_header[],content_type text,content text);
CREATE TYPE extensions.http_response AS (status integer,content_type text,headers extensions.http_header[],content text);
CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
CREATE TABLE net._http_response(id bigint,status_code integer);
CREATE TABLE net.http_request_queue(id bigint);
CREATE TABLE cron.job(jobid bigint,jobname text,schedule text,command text,active boolean);
CREATE FUNCTION extensions.http_set_curlopt(text,text) RETURNS boolean LANGUAGE sql AS 'SELECT true';
CREATE FUNCTION extensions.http(extensions.http_request) RETURNS extensions.http_response LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'EXTERNAL_HTTP_FORBIDDEN';END$$;
CREATE FUNCTION net.http_get(url text,headers jsonb,timeout_milliseconds integer) RETURNS bigint LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'EXTERNAL_HTTP_FORBIDDEN';END$$;
REVOKE ALL ON SCHEMA net,vault,cron,extensions FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA net,extensions FROM PUBLIC,anon,authenticated,service_role;
