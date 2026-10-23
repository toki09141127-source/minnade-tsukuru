/* eslint-disable @typescript-eslint/no-require-imports -- Exact synthetic staging acceptance only. */
const fs = require("fs"),
  assert = require("node:assert/strict");
const { randomUUID } = require("crypto"),
  { createClient } = require("@supabase/supabase-js");
(async () => {
  let db,
    phase = "setup",
    action,
    feature,
    initialFlags,
    f;
  const report = process.argv.includes("--remaining")
    ? JSON.parse(fs.readFileSync("docs/v2-rc-preview-scenarios.json"))
    : {
        complete: false,
        scope: "Hosted Preview APIs + actual staging synthetic fixtures",
        checks: [],
        productionChanges: "NONE",
        liveBilling: "OFF",
        realAiCalls: 0,
      };
  if (report.failure) {
    report.previousTestSetupFailure = report.failure;
    delete report.failure;
  }
  report.complete = false;
  const save = () =>
    fs.writeFileSync(
      "docs/v2-rc-preview-scenarios.json",
      JSON.stringify(report, null, 2) + "\n",
    );
  const ok = (name) => {
    report.checks.push({ name, pass: true });
    save();
    console.log("PASS " + name);
  };
  const safe = (value, label) => assert.ok(value, label);
  try {
    const { deployment, access } = require("./preview-scope.cjs"),
      { d, ctx } = deployment(),
      a = access();
    report.previewUrl = d.url;
    db = (await require("../billing/db.cjs")()).db;
    f = JSON.parse(fs.readFileSync(".staging-private/v2rc-e2e.json"));
    assert.equal(f.projectRef, ctx.ref);
    const saveFixture = () =>
      fs.writeFileSync(".staging-private/v2rc-e2e.json", JSON.stringify(f));
    const clients = [],
      tokens = [];
    for (const u of f.users.slice(0, 4)) {
      assert.match(u.email, /^v2rc-.*@example\.invalid$/);
      const c = createClient(ctx.url, ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const r = await c.auth.signInWithPassword({
        email: u.email,
        password: u.password,
      });
      safe(!r.error, "LOGIN");
      clients.push(c);
      tokens.push(r.data.session.access_token);
    }
    const service = createClient(ctx.url, ctx.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anon = createClient(ctx.url, ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const call = async (actor, url, body, method = "POST") => {
      const headers = {
        Cookie: a.cookies.map((c) => c.name + "=" + c.value).join("; "),
      };
      if (actor !== null) headers.Authorization = "Bearer " + tokens[actor];
      if (body && !(body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
        headers.Origin = d.url;
        body = JSON.stringify(body);
      }
      const r = await fetch(d.url + url, {
        method,
        headers,
        body,
        redirect: "error",
      });
      let data;
      try {
        data = await r.json();
      } catch {
        throw Error("NON_JSON_RESPONSE");
      }
      return { status: r.status, data };
    };
    const read = async (section, target) => {
      const r = await call(
        0,
        "/api/admin?" +
          new URLSearchParams({ section, ...(target ? { target } : {}) }),
        undefined,
        "GET",
      );
      assert.equal(r.status, 200, "READ_" + section);
      return r.data;
    };
    const ver = async (type, id) =>
      type === "system"
        ? (await read("system")).detail.version
        : Number(
            (
              await db.query(
                "SELECT version FROM admin_subjects WHERE kind=$1 AND target_id=$2",
                [type === "work" ? "room" : type, id],
              )
            ).rows[0]?.version || 0,
          );
    const request = (act, type, target, version, value) => ({
      confirm: true,
      request: randomUUID(),
      action: act,
      type,
      target,
      version,
      value,
      reason: "operational",
      note: "Synthetic RC targeted acceptance",
    });
    action = async (actor, act, type, target, value) => {
      const b = request(act, type, target, await ver(type, target), value);
      const r = await call(actor, "/api/admin", b);
      assert.equal(
        r.status,
        200,
        "ACTION_" + act + "_" + (r.data.error || r.status),
      );
      return r;
    };
    initialFlags = (await db.query("SELECT mvp_private.v25_flags() flags"))
      .rows[0].flags;
    assert.deepEqual(initialFlags, f.initialFlags);
    feature = async (name, value) =>
      action(0, "feature", "system", name, value);
    const post = async (actor, room, upload) =>
      call(actor, "/api/posts/create", {
        roomId: room,
        content: "TEST RC safe operations",
        post_type: "log",
        requestId: randomUUID(),
        ...(upload ? { uploadId: upload } : {}),
      });
    const png = await require("sharp")({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 50, g: 130, b: 190 },
      },
    })
      .png()
      .toBuffer();
    const upload = async (actor, room) => {
      const b = new FormData();
      b.append("roomId", room);
      b.append("file", new Blob([png], { type: "image/png" }), "synthetic.png");
      return call(actor, "/api/uploads", b);
    };
    phase = "new synthetic room";
    f.followup ||= {};
    saveFixture();
    if (!f.followup.room) {
      const r = await clients[2].rpc("v24_create_room", {
        p_request: randomUUID(),
        p_title: "TEST RC operations",
        p_description:
          "これは運営停止と公開添付を検収するためだけの架空の共同作品です。",
        p_genre: "novel",
        p_deadline: new Date(Date.now() + 86400000).toISOString(),
        p_capacity: 10,
        p_ai: "assist",
        p_consent: "2026-10-22-v2.1",
        p_profile: null,
      });
      safe(!r.error, "FIXTURE_ROOM_" + r.error?.code);
      f.followup.room = r.data;
      saveFixture();
    }
    const room = f.followup.room;
    if (!f.followup.attachment) {
      const u = await upload(2, room);
      assert.equal(u.status, 200, "UPLOAD_FIXTURE");
      const p = await post(2, room, u.data.uploadId);
      assert.equal(p.status, 200, "POST_FIXTURE");
      f.followup.attachment = p.data.postId;
      saveFixture();
      const r = await clients[2].rpc("v2_post_action", {
        p_room: room,
        p_post: p.data.postId,
        p_action: "approve_public",
      });
      safe(!r.error, "APPROVE_FIXTURE");
    }
    if (!process.argv.includes("--remaining")) {
      if(!process.argv.includes("--after-suspension")){
      phase = "suspended writes and recovery";
      safe(
        (
          await db.query(
            "SELECT suspended FROM admin_suspensions WHERE user_id=$1",
            [f.users[3].id],
          )
        ).rows[0].suspended,
        "SUSPENDED_INITIAL",
      );
      assert.equal(
        (await post(3, f.rooms.active)).status,
        503,
        "SUSPENDED_POST",
      );
      assert.equal(
        (await upload(3, f.rooms.active)).status,
        503,
        "SUSPENDED_UPLOAD",
      );
      safe(
        (
          await clients[3].rpc("v2_member_action", {
            p_room: room,
            p_action: "join",
            p_consent: "2026-10-22-v2.1",
          })
        ).error,
        "SUSPENDED_JOIN",
      );
      ok("D suspended actor cannot post / upload / join");
      await action(1, "suspend", "user", f.users[3].id, false);
      try {
        const r = await clients[3].rpc("v2_member_action", {
          p_room: room,
          p_action: "join",
          p_consent: "2026-10-22-v2.1",
        });
        safe(!r.error, "RESTORED_JOIN");
        const u = await upload(3, f.rooms.active);
        assert.equal(u.status, 200, "RESTORED_UPLOAD");
        assert.equal(
          (await post(3, f.rooms.active, u.data.uploadId)).status,
          200,
          "RESTORED_POST",
        );
        ok("D restored actor can join / upload / post");
      } finally {
        await action(1, "suspend", "user", f.users[3].id, true);
      }
      }
      phase = "AI off human fallback";
      assert.equal(initialFlags.ai, false);
      assert.equal(
        (
          await call(2, "/api/v2/ai", {
            roomId: f.rooms.active,
            action: "request", requestId: randomUUID(), kind: "question", text: "TEST safe question",
          })
        ).status,
        503,
        "AI_OFF",
      );
      assert.equal(
        (await post(2, f.rooms.active)).status,
        200,
        "HUMAN_POST_AI_OFF",
      );
      if (!f.followup.published) {
        await db.query("BEGIN");
        await db.query("SET LOCAL session_replication_role='replica'");
        await db.query(
          "UPDATE rooms SET expires_at=now()-interval '1 minute' WHERE id=$1",
          [room],
        );
        await db.query("COMMIT");
        await db.query("SELECT v22_publish_room($1)", [room]);
        f.followup.published = true;
        saveFixture();
      }
      const publicWork = async () => {
        const r = await call(
          null,
          "/api/v2/work?roomId=" + room,
          undefined,
          "GET",
        );
        assert.equal(r.status, 200, "PUBLIC_WORK");
      };
      await publicWork();
      ok(
        "F AI OFF denies manual request; human posting and forced publication succeed",
      );
      phase = "upload stop existing read";
      await feature("uploads", false);
      try {
        assert.equal(
          (await upload(2, f.rooms.active)).status,
          503,
          "UPLOAD_OFF",
        );
        const r = await call(null, "/api/storage/sign", {
          postId: f.followup.attachment,
        });
        assert.equal(r.status, 200, "EXISTING_ATTACHMENT");
        const u = new URL(r.data.signedUrl);
        assert.equal(u.origin, ctx.url);
        const image = await fetch(u, { redirect: "error" });
        assert.equal(image.status, 200);
        safe(
          (image.headers.get("content-type") || "").startsWith("image/"),
          "ATTACHMENT_IMAGE",
        );
        ok(
          "G upload OFF rejects new object and preserves published attachment read",
        );
      } finally {
        await feature("uploads", true);
      }
      phase = "public log hide";
      const publicLog = async () => {
        const r = await call(
          null,
          "/api/v2/log?roomId=" + room,
          undefined,
          "GET",
        );
        assert.equal(r.status, 200);
        return r.data.posts;
      };
      safe(
        (await publicLog()).some((p) => p.id === f.followup.attachment),
        "PUBLIC_LOG_PRESENT",
      );
      await action(1, "hide", "post", f.followup.attachment, true);
      try {
        safe(
          !(await publicLog()).some((p) => p.id === f.followup.attachment),
          "PUBLIC_LOG_HIDDEN",
        );
        assert.equal(
          (
            await call(null, "/api/storage/sign", {
              postId: f.followup.attachment,
            })
          ).status,
          404,
          "HIDDEN_ATTACHMENT",
        );
        await publicWork();
        ok(
          "N hidden log post and attachment disappear; published work stays consistent",
        );
      } finally {
        await action(1, "hide", "post", f.followup.attachment, false);
      }
      phase = "suspended creator published retention";
      await action(1, "suspend", "user", f.users[2].id, true);
      try {
        await publicWork();
        assert.equal((await post(2, f.rooms.active)).status, 503);
        ok(
          "O suspended Creator retains published work; active-room writes denied",
        );
      } finally {
        await action(1, "suspend", "user", f.users[2].id, false);
      }
      phase = "deletion stopped";
      const count = await db.query(
        "SELECT count(*)::int n FROM account_deletion_jobs WHERE actor_id=$1",
        [f.users[2].id],
      );
      const r = await service.rpc("mvp_request_deletion", {
        p_actor: f.users[2].id,
        p_attribution: "anonymous",
        p_policy: "withdrawal-draft-2026-10-21",
      });
      safe(r.error?.message === "FEATURE_STOPPED", "DELETION_INTAKE_OFF");
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM account_deletion_jobs WHERE actor_id=$1",
            [f.users[2].id],
          )
        ).rows[0].n,
        count.rows[0].n,
      );
      safe(
        (await db.query("SELECT mvp_deletion_operations() op")).rows[0].op
          .paused,
        "WORKER_PAUSED",
      );
      ok("H intake OFF creates no deletion job; worker stays paused");
    }
    phase = "dismiss independent of hide";
    if (!f.followup.report) {
      const r = await service.rpc("mvp_receive_report", {
        p_actor: f.users[0].id,
        p_request: randomUUID(),
        p_type: "room",
        p_target: room,
        p_reason: "TEST operations review",
      });
      safe(!r.error, "REPORT_FIXTURE_" + r.error?.code);
      f.followup.report = r.data[0].receipt_id;
      saveFixture();
    }
    await action(1, "hide", "work", room, true);
    let review = await read("reports", f.followup.report);
    if (review.items[0].status === "open")
      await action(1, "report", "report", f.followup.report, {
        status: "reviewing",
        category: "other",
      });
    review = await read("reports", f.followup.report);
    if (review.items[0].status === "reviewing")
      await action(1, "report", "report", f.followup.report, {
        status: "dismissed",
        category: "other",
      });
    assert.equal(
      (await read("reports", f.followup.report)).items[0].status,
      "dismissed",
    );
    safe(
      (await db.query("SELECT is_hidden FROM rooms WHERE id=$1", [room]))
        .rows[0].is_hidden,
      "DISMISS_NO_RESTORE",
    );
    ok("L report dismissal never restores hidden content");
    await action(1, "hide", "work", room, false);
    phase = "concurrent moderation";
    const v = await ver("post", f.followup.attachment),
      requests = [
        request("hide", "post", f.followup.attachment, v, true),
        request("hide", "post", f.followup.attachment, v, false),
      ];
    const race = await Promise.all(
      requests.map((r, i) => call(i, "/api/admin", r)),
    );
    assert.deepEqual(race.map((x) => x.status).sort(), [200, 409]);
    const audits = await db.query(
      "SELECT count(*)::int n FROM admin_audit WHERE request_id=ANY($1::uuid[])",
      [requests.map((r) => r.request)],
    );
    assert.equal(audits.rows[0].n, 1);
    await action(1, "hide", "post", f.followup.attachment, false);
    ok(
      "K Hosted concurrent hide/restore has one winner, one audit, safe conflict",
    );
    phase = "billing and audit metadata";
    const billing = await read("billing", f.users[2].id);
    safe(JSON.stringify(billing).includes("past_due"), "BILLING_GRACE");
    const classes = (
      await db.query(
        "SELECT DISTINCT action FROM admin_audit WHERE actor_id=ANY($1::uuid[])",
        [f.users.slice(0, 2).map((u) => u.id)],
      )
    ).rows.map((r) => r.action);
    for (const c of ["hide", "suspend", "report", "feature", "role"])
      safe(classes.includes(c), "AUDIT_CLASS_" + c);
    const denied = await anon.from("admin_audit").select("id").limit(1);
    safe(denied.error || !denied.data.length, "ANON_AUDIT");
    ok(
      "I/J test grace projection and action classes audited without public access",
    );
    report.complete = true;
  } catch (e) {
    report.failure = {
      phase,
      code: e.code || "CHECK_FAILED",
      actual: typeof e.actual === "number" || typeof e.actual === "boolean" ? e.actual : undefined, expected: typeof e.expected === "number" || typeof e.expected === "boolean" ? e.expected : undefined,
      check: /^[A-Z_0-9]+$/.test(e.message || "") ? e.message : "CHECK_FAILED",
    };
    process.exitCode = 1;
    console.log(JSON.stringify(report.failure));
  } finally {
    if (db) {
      await db.query("ROLLBACK").catch(() => {});
      try {
        if (initialFlags && feature) {
          const flags = (await db.query("SELECT mvp_private.v25_flags() flags"))
            .rows[0].flags;
          for (const k of Object.keys(initialFlags))
            if (flags[k] !== initialFlags[k]) await feature(k, initialFlags[k]);
          assert.deepEqual(
            (await db.query("SELECT mvp_private.v25_flags() flags")).rows[0]
              .flags,
            initialFlags,
          );
          report.flagsRestored = true;
        }
      } catch {
        report.cleanupRequired = true;
        report.complete = false;
        process.exitCode = 1;
      }
      await db.end();
    }
    save();
  }
})();
