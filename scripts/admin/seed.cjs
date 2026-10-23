/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs"),
  { randomUUID, randomBytes } = require("crypto"),
  assert = require("node:assert/strict"),
  { createClient } = require("@supabase/supabase-js");
(async () => {
  let db;
  try {
    const x = await require("../billing/db.cjs")();
    db = x.db;
    const { ctx } = x;
    assert.equal(ctx.ref, "fwqucffxdmbdczspkcyr");
    const file = ".staging-private/v25-e2e.json";
    if (fs.existsSync(file)) {
      const old = JSON.parse(fs.readFileSync(file));
      assert.equal(old.projectRef, ctx.ref);
      if (old.complete) {
        console.log(
          JSON.stringify({
            complete: true,
            reused: true,
            users: old.users.length,
          }),
        );
        return;
      }
      assert.ok(
        Object.keys(old.rooms).every((k) =>
          ["active", "published"].includes(k),
        ),
        "FIXTURE_SCOPE",
      );
    }
    const admin = createClient(ctx.url, ctx.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      f = fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file))
        : {
            projectRef: ctx.ref,
            runId: randomUUID(),
            users: [],
            rooms: {},
            reports: [],
            complete: false,
          };
    const save = () => fs.writeFileSync(file, JSON.stringify(f));
    save();
    for (const label of [
      "owner",
      "moderator",
      "member",
      "suspended",
      "departing",
    ]) {
      if (f.users.some((u) => u.label === label)) continue;
      const email =
          "v25-" + label + "-" + randomUUID().slice(0, 8) + "@example.invalid",
        password = randomBytes(24).toString("base64url") + "aA1!";
      const r = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.ok(!r.error, "SYNTHETIC_USER");
      f.users.push({ id: r.data.user.id, label, email, password });
      save();
    }
    const clients = {};
    for (const u of f.users) {
      const c = createClient(ctx.url, ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const r = await c.auth.signInWithPassword({
        email: u.email,
        password: u.password,
      });
      assert.ok(!r.error, "SYNTHETIC_LOGIN");
      assert.ok(
        !(
          await c.rpc("mvp_accept_current_terms", {
            p_terms: "2026-10-22",
            p_privacy: "2026-10-22",
            p_adult: true,
          })
        ).error,
      );
      clients[u.label] = c;
      await db.query("UPDATE profiles SET username=$2 WHERE id=$1", [
        u.id,
        "V25" + u.label + "_" + f.runId.slice(0, 6),
      ]);
    }
    const owner = f.users[0].id,
      mod = f.users[1].id,
      member = f.users[2].id;
    if (
      !(
        await db.query(
          "SELECT 1 FROM admin_users WHERE user_id=$1 AND role='owner'",
          [owner],
        )
      ).rowCount
    ) {
      await db.query("BEGIN");
      await db.query(
        "INSERT INTO admin_users(user_id,role) VALUES($1,'owner')",
        [owner],
      );
      await db.query("INSERT INTO moderation_operators(user_id) VALUES($1)", [
        owner,
      ]);
      await db.query(
        "INSERT INTO admin_audit(request_id,actor_id,actor_role,action,target_type,target_id,before_state,after_state,reason,request_hash) VALUES($1,$2::uuid,'owner','bootstrap','staff',($2::uuid)::text,'{}','{\"role\":\"owner\",\"synthetic\":true}','operational','staging-bootstrap')",
        [randomUUID(), owner],
      );
      await db.query("COMMIT");
    }
    const action = async (action, type, target, version, value) => {
      const r = await clients.owner.rpc("v25_admin_action", {
        p_request: randomUUID(),
        p_action: action,
        p_type: type,
        p_target: target,
        p_version: version,
        p_value: value,
        p_reason: "operational",
        p_note: "Synthetic staging verification",
      });
      assert.ok(
        !r.error && !r.data.error,
        "ADMIN_SEED_" + (r.data?.error || r.error?.code || "OK"),
      );
      return r.data;
    };
    if (
      !(
        await db.query(
          "SELECT 1 FROM admin_users WHERE user_id=$1 AND active",
          [mod],
        )
      ).rowCount
    )
      await action("role", "staff", mod, 0, "moderator");
    for (const key of ["active", "published"]) {
      if (f.rooms[key]) continue;
      const r = await clients.member.rpc("v24_create_room", {
        p_request: randomUUID(),
        p_title: "TEST V25 " + key,
        p_description: "架空の仲間が共同制作する運営検収用の作品です。",
        p_genre: "novel",
        p_deadline: new Date(Date.now() + 86400000).toISOString(),
        p_capacity: 10,
        p_ai: "assist",
        p_consent: "2026-10-22-v2.1",
        p_profile: null,
      });
      assert.ok(!r.error, "CREATE_FIXTURE_" + r.error?.code);
      f.rooms[key] = r.data;
      save();
    }
    const pub = f.rooms.published;
    await clients.suspended.rpc("v2_member_action", {
      p_room: f.rooms.active,
      p_action: "join",
      p_consent: "2026-10-22-v2.1",
    });
    const post = await admin.rpc("create_post_with_upload", {
      p_actor: member,
      p_room: pub,
      p_content: "TEST V25 共同制作の公開履歴です。",
      p_post_type: "log",
      p_upload: null,
      p_request_key:
        f.postRequest ||
        ((f.postRequest = randomUUID()), save(), f.postRequest),
    });
    assert.ok(!post.error, "SEED_POST_" + (post.error?.code || "OK"));
    f.post = post.data;
    save();
    const approval = await clients.member.rpc("v2_post_action", {
      p_room: pub,
      p_post: post.data,
      p_action: "approve_public",
    });
    assert.ok(!approval.error, "PUBLIC_REVIEW");
    // Test-fixture clock only, exact newly-created room; no production or existing data.
    await db.query("BEGIN");
    await db.query("SET LOCAL session_replication_role='replica'");
    await db.query(
      "UPDATE rooms SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [pub],
    );
    await db.query("COMMIT");
    await db.query("SELECT v22_publish_room($1)", [pub]);
    for (const target of [f.rooms.active, pub]) {
      const r = await admin.rpc("mvp_receive_report", {
        p_actor: mod,
        p_request: randomUUID(),
        p_type: "room",
        p_target: target,
        p_reason: "TEST privacy staging review",
      });
      assert.ok(!r.error, "SEED_REPORT");
      f.reports.push(r.data[0].receipt_id);
      save();
    }
    await action("suspend", "user", f.users[3].id, 0, true);
    const w = (
      await clients.owner.rpc("v25_admin_read", {
        p_section: "works",
        p_target: pub,
      })
    ).data;
    assert.ok(!w.error && w.items.length === 1, "PUBLISHED_FIXTURE");
    await action("hide", "work", pub, w.items[0].version, true);
    await db.query(
      "UPDATE room_ai_tasks SET status='failed',error_code='TEST_PROVIDER_FAILURE',finished_at=now() WHERE room_id=$1 AND status IN ('pending','skipped')",
      [f.rooms.active],
    );
    await db.query(
      "UPDATE billing_accounts SET provider='synthetic',plan='plus',cycle='month',status='past_due',period_start=now()-interval '1 day',period_end=now()+interval '29 days',grace_until=now()+interval '3 days' WHERE owner_id=$1",
      [member],
    );
    await db.query(
      "INSERT INTO account_deletion_jobs(actor_id,attribution,policy_version) VALUES($1,'keep_name','withdrawal-draft-2026-10-21')",
      [f.users[4].id],
    );
    f.initialFlags = (
      await db.query("SELECT mvp_private.v25_flags() flags")
    ).rows[0].flags;
    f.complete = true;
    save();
    console.log(
      JSON.stringify({
        complete: true,
        syntheticUsers: f.users.length,
        rooms: 2,
        reports: 2,
        aiEnabled: f.initialFlags.ai,
        deletionWorker: f.initialFlags.deletion_worker,
        productionChanges: "NONE",
      }),
    );
  } catch (e) {
    console.log(
      JSON.stringify({
        complete: false,
        code: e.code || "SEED_FAILED",
        reason: /^[A-Z_0-9]+$/.test(e.message || "")
          ? e.message
          : "CHECK_FAILED",
      }),
    );
    process.exitCode = 1;
  } finally {
    if (db) {
      await db.query("ROLLBACK").catch(() => {});
      await db.end();
    }
  }
})();
