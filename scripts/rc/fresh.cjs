/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  net = require("node:net"),
  cp = require("node:child_process");
const { load } = require("../staging/safety.cjs");
(async () => {
  const env = load().env,
    runtime = env.MVP_TEST_RUNTIME,
    { Client } = require(path.join(runtime, "node_modules/pg"));
  const metadata = path.join(path.dirname(runtime), ".staging-private");
  const m = JSON.parse(
      fs.readFileSync(path.join(metadata, "baseline-audit-2026-10-21.json")),
    ),
    extra = JSON.parse(
      fs.readFileSync(
        path.join(metadata, "baseline-completion-2026-10-21.json"),
      ),
    );
  const root = process.cwd(),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "minnade-v2-test-")),
    data = path.join(dir, "data"),
    bin = path.join(
      runtime,
      "node_modules/@embedded-postgres/windows-x64/native/bin",
    );
  const socket = net.createServer();
  await new Promise((r) => socket.listen(0, "127.0.0.1", r));
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  const run = (exe, args) => {
    const q = cp.spawnSync(path.join(bin, exe + ".exe"), args, {
      windowsHide: true,
      stdio: "ignore",
      timeout: 30000,
    });
    if (q.status !== 0) throw Error("LOCAL_PG_" + exe);
  };
  const report = {
    scope: "fresh isolated PostgreSQL; audited baseline; canonical main+V2; synthetic only",
    migrations: [],
    checks: [],
    complete: false,
  };
  let c,
    started = false,
    phase = "init";
  try {
    run("initdb", [
      "-D",
      data,
      "-U",
      "fixture_admin",
      "--auth=trust",
      "--locale=C",
      "--encoding=UTF8",
    ]);
    fs.appendFileSync(
      path.join(data, "postgresql.conf"),
      "\nlisten_addresses='127.0.0.1'\nport=" + port + "\n",
    );
    run("pg_ctl", [
      "-D",
      data,
      "-l",
      path.join(dir, "server.log"),
      "-w",
      "start",
    ]);
    started = true;
    const options = {
      host: "127.0.0.1",
      port,
      user: "fixture_admin",
      database: "postgres",
      statement_timeout: 12000,
    };
    c = new Client(options);
    await c.connect();
    await c.query(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role; CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text); CREATE TABLE storage.buckets(id text PRIMARY KEY,owner uuid,owner_id text);",
    );
    phase = "baseline";
    await c.query("BEGIN; SET LOCAL check_function_bodies=off;");
    await c.query(require("../staging/baseline-render.cjs")(m, extra));
    await c.query("COMMIT");
    await require("./migrations.cjs").applyLocal(c, report);
    await require("./buffer-compat.cjs")({db:c,report});
    phase = "behavior";
    // Legacy regression intentionally exercises enabled deletion; this is an isolated test DB.
    await c.query(
      "UPDATE mvp_private.admin_control SET flags=jsonb_set(flags,'{deletion_intake}','true') WHERE singleton",
    );
    const connect = async () => {
      const db = new Client(options);
      await db.connect();
      return db;
    };
    if (!process.argv.includes("--admin-only")) {
      await require("../v2/behavior.cjs")({ db: c, connect, report });
      phase = "AI behavior";
      await require("../ai/behavior.cjs")({ db: c, connect, report });
      phase = "billing behavior";
      await require("../billing/behavior.cjs")({ db: c, connect, report });
    }
    phase = "admin behavior";
    if (process.argv.includes("--debug-local")) {
      const def = (
        await c.query(
          "SELECT pg_get_functiondef('v25_admin_read(text,text,jsonb,text,integer,integer,uuid)'::regprocedure) d",
        )
      ).rows[0].d;
      await c.query(
        def.replace(
          "THEN code:='ADMIN_READ_FAILED';END IF;",
          "THEN RAISE;END IF;",
        ),
      );
    }

    if (fs.existsSync("scripts/admin/behavior.cjs"))
      await require("../admin/behavior.cjs")({ db: c, connect, report });
    phase = 'synthetic backup restore';
    await require('./restore.cjs')({db:c,options,Client,dir,bin,report});
    report.complete = true;
  } catch (e) {
    report.failure = {
      phase: e.migration ?? phase,
      code: e.code || "CHECK_FAILED",
      position: e.position,
      internalPosition: e.internalPosition,
      internalQuery: e.internalQuery,
      message: String(e.message).slice(0, 280),
      context: String(e.where ?? "").slice(0, 1200),
    };
    process.exitCode = 1;
  } finally {
    if (c) {
      await c.query("ROLLBACK").catch(() => {});
      await c.end();
    }
    if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    report.serverStopped = true;
    const relative=path.relative(path.resolve(os.tmpdir()),path.resolve(dir));
    if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!path.basename(dir).startsWith('minnade-v2-test-'))throw Error('UNSAFE_TEMP_PATH');
    fs.rmSync(dir,{recursive:true,force:true});
    report.temporaryClusterRemoved=true;
    fs.writeFileSync(
      path.join(root, "docs/v2-rc-fresh-result.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        complete: report.complete,
        checks: report.checks.length,
        failure: report.failure,
        serverStopped: report.serverStopped,
      }),
    );
  }
})().catch(() => {
  console.error("V2_LOCAL_SETUP_FAILED");
  process.exitCode = 1;
});
