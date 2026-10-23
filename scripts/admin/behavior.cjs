/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict"),
  { randomUUID } = require("node:crypto");
module.exports = async ({ db, connect, report }) => {
  const ok = (v, name) => {
    assert.ok(v, name);
    report.checks.push({ name: "V25 " + name, pass: true });
  };
  const as = async (actor, sql, args = [], role = "authenticated", age = 0) => {
    const c = await connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE " + role);
      await c.query(
        "SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
        [
          actor || "",
          JSON.stringify({
            sub: actor,
            iat: Math.floor(Date.now() / 1000) - age,
          }),
        ],
      );
      const r = await c.query(sql, args);
      await c.query("COMMIT");
      return r.rows;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      await c.end();
    }
  };
  const users = Array.from({ length: 5 }, () => randomUUID()),
    [owner, mod, normal, other, spare] = users;
  for (const id of users) {
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
    await as(
      id,
      "SELECT mvp_accept_current_terms('2026-10-22','2026-10-22',true)",
    );
  }
  for (const [id, role] of [
    [owner, "owner"],
    [mod, "moderator"],
  ]) {
    await db.query("INSERT INTO admin_users(user_id,role) VALUES($1,$2)", [
      id,
      role,
    ]);
    await db.query("INSERT INTO moderation_operators(user_id) VALUES($1)", [
      id,
    ]);
  }
  const action = async (
    actor,
    act,
    type,
    target,
    version,
    value,
    request = randomUUID(),
    age = 0,
  ) =>
    (
      await as(
        actor,
        "SELECT v25_admin_action($1,$2,$3,$4,$5,$6,$7,$8) x",
        [
          request,
          act,
          type,
          target,
          version,
          JSON.stringify(value),
          "operational",
          "Synthetic verification",
        ],
        "authenticated",
        age,
      )
    )[0].x;
  const read = async (actor, section, target = null, filters = {}) =>
    (
      await as(actor, "SELECT v25_admin_read($1,'',$2,'newest',0,7,$3) x", [
        section,
        JSON.stringify(filters),
        target,
      ])
    )[0].x;
  const flagVersion = async () =>
    Number(
      (await db.query("SELECT version FROM mvp_private.admin_control")).rows[0]
        .version,
    );
  const feature = async (name, value) =>
    action(owner, "feature", "system", name, await flagVersion(), value);
  const denied = async (fn, name) => {
    await assert.rejects(fn);
    ok(true, name);
  };
  for (const t of [
    "admin_users",
    "admin_audit",
    "admin_notes",
    "admin_subjects",
    "admin_suspensions",
    "admin_room_controls",
    "admin_report_reviews",
    "admin_security_events",
  ]) {
    await denied(
      () => as(owner, "SELECT * FROM " + t),
      "direct table read denied " + t,
    );
    await denied(
      () => as(owner, "DELETE FROM " + t),
      "direct write denied " + t,
    );
  }
  ok(
    (await read(normal, "overview")).error === "ADMIN_FORBIDDEN",
    "normal user no admin read",
  );
  ok(
    (await action(normal, "feature", "system", "posts", 0, false)).error ===
      "ADMIN_FORBIDDEN",
    "normal user no admin mutation",
  );
  await denied(
    () => as(null, "SELECT v25_admin_read('overview')", [], "anon"),
    "anon RPC revoked",
  );
  await denied(
    () => as(null, "SELECT v25_admin_read('overview')", [], "service_role"),
    "service cannot impersonate staff",
  );
  ok(
    (await read(mod, "system")).error === "OWNER_REQUIRED",
    "Moderator system denied",
  );
  ok(
    (await action(mod, "feature", "system", "posts", 0, false)).error ===
      "OWNER_REQUIRED",
    "Moderator flag denied",
  );
  ok(
    (
      await action(
        owner,
        "feature",
        "system",
        "posts",
        0,
        false,
        randomUUID(),
        7200,
      )
    ).error === "RECENT_LOGIN_REQUIRED",
    "old token mutation denied",
  );
  for (const s of [
    "overview",
    "reports",
    "users",
    "rooms",
    "works",
    "ai",
    "billing",
    "system",
    "audit",
    "staff",
  ]) {
    const r = await read(owner, s);
    ok(!r.error, "Owner projection " + s + ": " + (r.error || "OK"));
  }
  ok(
    !(await read(mod, "billing")).error,
    "Moderator billing is bounded read only",
  );
  const grant = await action(owner, "role", "staff", spare, 0, "moderator");
  ok(grant.ok, "Owner grants Moderator");
  ok(!(await read(spare, "overview")).error, "new Moderator reads");
  ok(
    (await action(owner, "role", "staff", spare, 1, "revoked")).ok,
    "Owner revokes Moderator",
  );
  ok(
    (await read(spare, "overview")).error === "ADMIN_FORBIDDEN",
    "revocation effective immediately",
  );
  ok(
    (await action(owner, "role", "staff", owner, 1, "revoked")).error ===
      "INVALID_INPUT",
    "Owner cannot revoke self",
  );
  const makeRoom = async (actor) => {
    await db.query("TRUNCATE mvp_rate_limits");
    return (
      await as(
        actor,
        "SELECT v24_create_room($1,'TEST ADMIN','架空の運営検収用ルーム。個人情報は含みません。','novel',$2,10,'assist','2026-10-22-v2.1',NULL) id",
        [randomUUID(), new Date(Date.now() + 86400000)],
      )
    )[0].id;
  };
  const room = await makeRoom(normal);
  ok(
    !(await read(owner, "rooms", room)).error,
    "room details members snapshot metadata",
  );
  const req = randomUUID(),
    hide = await action(mod, "hide", "room", room, 0, true, req);
  ok(hide.ok, "Moderator hide room");
  ok(
    (await action(mod, "hide", "room", room, 0, true, req)).replayed,
    "exact retry idempotent",
  );
  ok(
    (await action(mod, "hide", "room", room, 0, false, req)).error ===
      "REQUEST_CONFLICT",
    "request reuse with changed content denied",
  );
  ok(
    (await action(mod, "hide", "room", room, 0, false)).error ===
      "VERSION_CONFLICT",
    "stale restore rejected",
  );
  ok((await action(mod, "hide", "room", room, 1, false)).ok, "current restore");
  const race = await Promise.all([
    action(mod, "hide", "room", room, 2, true),
    action(owner, "hide", "room", room, 2, false),
  ]);
  ok(
    race.filter((x) => x.ok).length === 1 &&
      race.some((x) => x.error === "VERSION_CONFLICT"),
    "two moderators CAS single winner",
  );
  await db.query("TRUNCATE mvp_private.admin_rate");
  const snapshot = (await db.query("SELECT count(*) n FROM admin_audit"))
    .rows[0].n;
  ok(
    (await action(mod, "hide", "room", randomUUID(), 0, true)).error,
    "missing target rejected",
  );
  ok(
    (await db.query("SELECT count(*) n FROM admin_audit")).rows[0].n ===
      snapshot,
    "failed transaction no success audit",
  );
  await denied(
    () => db.query("UPDATE admin_audit SET reason='other'"),
    "audit immutable even owner SQL",
  );
  await denied(() => db.query("DELETE FROM admin_notes"), "notes immutable");
  ok(
    (await action(mod, "suspend", "user", other, 0, true)).ok,
    "Moderator suspends ordinary user",
  );
  await denied(() => makeRoom(other), "suspended create room blocked");
  ok(
    (
      await as(other, "SELECT v25_check_operation('posts',$1,NULL) allowed", [
        other,
      ])
    )[0].allowed === false,
    "suspended posts gate denied",
  );
  ok(
    (await action(other, "suspend", "user", other, 1, false)).error ===
      "ADMIN_FORBIDDEN",
    "self unsuspend denied",
  );
  ok(
    (await action(mod, "suspend", "user", other, 1, false)).ok,
    "Moderator restores user",
  );
  ok(
    (await as(other, "SELECT mvp_current_account_active() a"))[0].a,
    "restored active",
  );
  ok((await feature("room_creation", false)).ok, "room creation off audited");
  await denied(() => makeRoom(other), "direct RPC blocked by global stop");
  ok((await feature("room_creation", true)).ok, "room creation recovery");
  ok((await feature("posts", false)).ok, "posts stop");
  ok(
    (
      await as(normal, "SELECT v25_check_operation('posts',$1,$2) a", [
        normal,
        room,
      ])
    )[0].a === false,
    "post preflight stopped",
  );
  ok(
    (await action(mod, "hide", "room", room, 3, true)).ok,
    "moderation capability works during post stop",
  );
  ok((await feature("posts", true)).ok, "posts resume");
  const ver = Number(
    (
      await db.query(
        "SELECT version FROM admin_subjects WHERE kind='room' AND target_id=$1",
        [room],
      )
    ).rows[0].version,
  );
  ok(
    (
      await action(owner, "room_controls", "room", room, ver, {
        joins: false,
        posts: true,
        uploads: false,
      })
    ).ok,
    "per room controls",
  );
  ok(
    (
      await as(normal, "SELECT v25_check_operation('uploads',$1,$2) a", [
        normal,
        room,
      ])
    )[0].a === false,
    "per room upload stopped",
  );
  const receipt = randomUUID();
  await db.query(
    "INSERT INTO report_intake(id,reporter_user_id,request_id,target_type,target_id,reason,state) VALUES($1,$2,$3,'room',$4,'TEST privacy','pending')",
    [receipt, other, randomUUID(), room],
  );
  ok(
    (
      await action(mod, "report", "report", receipt, 0, {
        status: "resolved",
        category: "privacy",
      })
    ).error === "INVALID_TRANSITION",
    "report open cannot skip review",
  );
  ok(
    (
      await action(mod, "report", "report", receipt, 0, {
        status: "reviewing",
        category: "privacy",
      })
    ).ok,
    "report review priority",
  );
  ok(
    (
      await action(mod, "report", "report", receipt, 1, {
        status: "resolved",
        category: "privacy",
      })
    ).ok,
    "report resolve independently audited",
  );
  ok(
    (await read(owner, "reports", receipt)).detail.notes.length === 2,
    "report notes history bounded",
  );
  ok(
    (
      await action(mod, "report", "report", receipt, 2, {
        status: "reviewing",
        category: "privacy",
      })
    ).error === "INVALID_TRANSITION",
    "resolved immutable lifecycle",
  );
  const data = JSON.stringify(await read(owner, "billing"));
  ok(
    !/stripe_customer|stripe_subscription|secret|raw_user_meta_data|@/.test(
      data,
    ),
    "billing projection excludes PII and provider identifiers",
  );
  ok((await feature("forced_publish", false)).ok, "publish stop");
  await denied(
    () => db.query("SELECT mvp_private.v22_publish_rooms($1)", [[room]]),
    "forced publication stop DB enforced",
  );
  ok((await feature("forced_publish", true)).ok, "publish resume");
  ok((await feature("moderation", false)).ok, "moderation stop");
  ok(
    (await action(mod, "suspend", "user", other, 2, true)).error ===
      "FEATURE_STOPPED",
    "moderation writes stopped",
  );
  ok(
    (await feature("moderation", true)).ok,
    "Owner can recover stopped moderation",
  );
  ok((await feature("deletion_intake", false)).ok, "deletion intake stop");
  await denied(
    () =>
      as(
        null,
        "SELECT mvp_request_deletion($1,'retain','2026-10-22')",
        [other],
        "service_role",
      ),
    "new deletion refused while stopped",
  );
  ok((await feature("deletion_intake", true)).ok, "deletion intake resume");
  await db.query("TRUNCATE mvp_private.admin_rate");
  // The fixed minute bucket may roll over during connection setup. Two buckets
  // require at most 61 denials; do not reset or weaken the actual limiter.
  let limited = false;
  for (let n = 0; n < 61 && !limited; n++) {
    const r = await action(normal, "suspend", "user", other, 0, true);
    assert.ok(["ADMIN_FORBIDDEN", "ADMIN_RATE_LIMITED"].includes(r.error));
    limited = r.error === "ADMIN_RATE_LIMITED";
  }
  ok(limited, "failed attempts also rate limited across minute boundary");
  ok(
    Number(
      (
        await db.query(
          "SELECT count(*) n FROM admin_security_events WHERE kind='admin_denied'",
        )
      ).rows[0].n,
    ) > 0,
    "denied attempts safely recorded",
  );

  await db.query("TRUNCATE mvp_private.admin_rate");
  const hold = await connect();
  let stopped = false;
  try {
    await hold.query("BEGIN");
    await hold.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
      normal,
    ]);
    await hold.query("SELECT mvp_private.v25_gate('posts',$1,$2)", [
      normal,
      room,
    ]);
    const off = feature("posts", false).then((r) => {
      stopped = true;
      return r;
    });
    await new Promise((r) => setTimeout(r, 180));
    ok(!stopped, "stop waits for authorized in-flight DB write");
    await hold.query("COMMIT");
    ok((await off).ok, "stop commits after in-flight write");
    ok(
      (
        await as(normal, "SELECT v25_check_operation('posts',$1,$2) a", [
          normal,
          room,
        ])
      )[0].a === false,
      "no new write after stop commits",
    );
  } finally {
    await hold.query("ROLLBACK");
    await hold.end();
  }
  ok((await feature("posts", true)).ok, "post stop recovery after race");
  const rv = Number(
    (
      await db.query(
        "SELECT version FROM admin_subjects WHERE kind='room' AND target_id=$1",
        [room],
      )
    ).rows[0].version,
  );
  await action(owner, "hide", "room", room, rv, false);
  await denied(
    () => as(mod, "SELECT v22_ai_hide($1,$2)", [room, randomUUID()]),
    "legacy operator registry cannot bypass admin moderation",
  );
  const post = (
    await db.query(
      "SELECT create_post_with_upload($1,$2,'TEST moderation history','log',NULL,$3) id",
      [normal, room, randomUUID()],
    )
  ).rows[0].id;
  ok(!(await read(mod, "posts", post)).error, "bounded post details");
  await db.query(
    "INSERT INTO account_deletion_jobs(actor_id,attribution,policy_version) VALUES($1,'keep_name','withdrawal-draft-2026-10-21')",
    [normal],
  );
  await denied(
    () =>
      db.query(
        "SELECT create_post_with_upload($1,$2,'TEST blocked','log',NULL,$3)",
        [normal, room, randomUUID()],
      ),
    "departing user cannot post",
  );
  ok(
    (await action(mod, "hide", "post", post, 0, true)).ok,
    "limited moderation works while author departing",
  );
  ok(
    (await db.query("SELECT content FROM posts WHERE id=$1", [post])).rows[0]
      .content === "TEST moderation history",
    "moderation retains content and production history",
  );
  ok(
    (await action(mod, "hide", "post", post, 1, false)).ok,
    "restore departing author post without enabling user writes",
  );
  ok(
    (await action(mod, "suspend", "user", owner, 0, true)).error ===
      "TARGET_UNAVAILABLE",
    "cannot suspend staff through user moderation",
  );
  await denied(
    () =>
      as(owner, "SELECT v25_request_deletion_base($1,$2,$3)", [
        owner,
        "keep_name",
        "withdrawal-draft-2026-10-21",
      ]),
    "private intake base inaccessible",
  );
  await denied(
    () =>
      as(owner, "SELECT v25_webhook_claim_base($1,$2,$3,$4,now(),$5)", [
        "synthetic",
        "x",
        "x",
        "x",
        "x",
      ]),
    "private webhook base inaccessible",
  );

  await db.query("TRUNCATE mvp_private.admin_rate");
  const sr = await Promise.all([
    action(owner, "suspend", "user", other, 2, true),
    action(mod, "suspend", "user", other, 2, false),
  ]);
  ok(
    sr.filter((r) => r.ok).length === 1 &&
      sr.some((r) => r.error === "VERSION_CONFLICT"),
    "concurrent suspend/restore single winner",
  );
  const receipt2 = randomUUID();
  await db.query(
    "INSERT INTO report_intake(id,reporter_user_id,request_id,target_type,target_id,reason,state) VALUES($1,$2,$3,'room',$4,'TEST review race','pending')",
    [receipt2, other, randomUUID(), room],
  );
  await action(owner, "report", "report", receipt2, 0, {
    status: "reviewing",
    category: "other",
  });
  const rr = await Promise.all([
    action(owner, "report", "report", receipt2, 1, {
      status: "resolved",
      category: "other",
    }),
    action(mod, "report", "report", receipt2, 1, {
      status: "dismissed",
      category: "other",
    }),
  ]);
  ok(
    rr.filter((r) => r.ok).length === 1 &&
      rr.some((r) => r.error === "VERSION_CONFLICT"),
    "concurrent report resolve/dismiss single winner",
  );
  const fv = await flagVersion();
  const fr = await Promise.all([
    action(owner, "feature", "system", "ai", fv, false),
    action(owner, "feature", "system", "ai", fv, false),
  ]);
  ok(
    fr.filter((r) => r.ok).length === 1 &&
      fr.some((r) => r.error === "VERSION_CONFLICT"),
    "AI emergency toggle CAS under concurrency",
  );
  ok(
    (await db.query("SELECT enabled FROM mvp_private.ai_control")).rows[0]
      .enabled === false,
    "AI actual control disabled",
  );
  const worker = await connect();
  try {
    await worker.query("BEGIN");
    await worker.query(
      "SELECT * FROM mvp_private.deletion_control WHERE singleton FOR SHARE",
    );
    let done = false;
    const stop = feature("deletion_worker", false).then((r) => {
      done = true;
      return r;
    });
    await new Promise((r) => setTimeout(r, 180));
    ok(!done, "deletion pause waits for worker checkpoint transaction");
    await worker.query("COMMIT");
    ok((await stop).ok, "deletion pause commits after checkpoint");
  } finally {
    await worker.query("ROLLBACK");
    await worker.end();
  }
  const restricted = await read(mod, "audit", null, { action: "feature" });
  ok(
    restricted.items.length === 0,
    "Moderator cannot read Owner-only audit actions",
  );
  ok(
    (await action(mod, "role", "staff", spare, 2, "moderator")).error ===
      "OWNER_REQUIRED",
    "Moderator cannot edit admin roles",
  );
  ok(
    (await action(owner, "billing", "user", other, 3, { plan: "pro" }))
      .error === "INVALID_INPUT",
    "no manual entitlement action exists",
  );
};
