/* eslint-disable @typescript-eslint/no-require-imports -- Offline route and token tests. */
const fs = require("fs"),
  vm = require("vm"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
let enabled = true,
  user = null,
  active = true,
  fail = null,
  calls = [],
  rows = [],
  snapshots = [];
const client = {
  auth: { getUser: async () => ({ data: { user } }) },
  rpc: async (name) => {
    calls.push({ rpc: name });
    return { data: active, error: null };
  },
  from(table) {
    const call = { table, ops: [] };
    calls.push(call);
    const query = {
      then(resolve) {
        return Promise.resolve({
          data:
            table === "rooms"
              ? rows
              : table === "v2_work_snapshots"
                ? snapshots
                : [],
          error: fail,
        }).then(resolve);
      },
    };
    for (const op of [
      "select",
      "eq",
      "is",
      "gt",
      "in",
      "ilike",
      "order",
      "range",
      "limit",
    ])
      query[op] = (...args) => {
        call.ops.push([op, ...args]);
        return query;
      };
    return query;
  },
};
const mod = { exports: {} },
  code = ts.transpileModule(
    fs.readFileSync("app/api/v2/catalog/route.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
vm.runInNewContext(code, {
  module: mod,
  exports: mod.exports,
  require: (n) =>
    n === "next/server"
      ? { NextResponse: { json: (b, o) => new Response(JSON.stringify(b), o) } }
      : n === "@/lib/v2/server"
        ? { v2Enabled: () => enabled, v2Client: () => client }
        : n === "@/lib/v2/domain"
          ? { GENRES: { novel: "小説" } }
          : (() => {
              throw Error("UNEXPECTED_DEPENDENCY");
            })(),
  URL,
  Date,
  Set,
  Error,
});
const out = { checks: [], complete: false, network: "NONE" },
  ok = (name) => out.checks.push({ name, pass: true });
const get = async (q = "", auth = false) => {
  calls = [];
  const r = await mod.exports.GET(
    new Request("http://test.invalid/api/v2/catalog" + q, {
      headers: auth ? { authorization: "Bearer synthetic" } : {},
    }),
  );
  return { status: r.status, body: await r.json() };
};
(async () => {
  enabled = false;
  assert.equal((await get()).status, 503);
  assert.equal(calls.length, 0);
  ok("Disabled V2 rejects before reading");
  enabled = true;
  for (const q of [
    "?page=-1",
    "?page=501",
    "?page=1.5",
    "?mode=admin",
    "?genre=unknown",
    "?ai=unknown",
    "?sort=secret",
    "?q=" + "a".repeat(101),
  ]) {
    assert.equal((await get(q)).status, 400);
    assert.equal(calls.length, 0);
    ok("Malformed filter rejected " + out.checks.length);
  }
  for (const q of ["?mine=true", "?mode=activity"]) {
    assert.equal((await get(q)).status, 401);
    ok("Anonymous private collection rejected " + out.checks.length);
  }
  assert.equal((await get("", true)).status, 401);
  ok("Invalid token cannot silently become anonymous");
  user = { id: "synthetic-actor" };
  active = false;
  assert.equal((await get("?mine=true", true)).status, 403);
  assert.ok(!calls.some((x) => x.table));
  ok("Departing account rejected before collection reads");
  active = true;
  await get("?mode=activity&userId=someone-else", true);
  assert.ok(
    calls
      .find((x) => x.table === "room_join_requests")
      .ops.some((x) => x[0] === "eq" && x[1] === "user_id" && x[2] === user.id),
  );
  ok("Activity always scopes to authenticated actor");
  await get("?mine=true", true);
  assert.ok(
    calls
      .find((x) => x.table === "room_members")
      .ops.some((x) => x[0] === "is" && x[1] === "left_at"),
  );
  ok("Active My Page excludes exited rooms");
  await get("?mode=works&mine=true", true);
  assert.ok(
    !calls
      .find((x) => x.table === "room_members")
      .ops.some((x) => x[0] === "is" && x[1] === "left_at"),
  );
  ok("Published My Page retains exited contributions");
  rows = Array.from({ length: 19 }, (_, i) => ({
    id: "id" + i,
    title: "safe",
    concept: "safe",
    status: "open",
  }));
  const r = await get();
  assert.equal(r.status, 200);
  assert.equal(r.body.rooms.length, 18);
  assert.equal(r.body.hasMore, true);
  assert.ok(
    calls[0].ops.some((x) => x[0] === "range" && x[1] === 0 && x[2] === 18),
  );
  ok("Pagination returns eighteen plus continuation");
  for (const [field, value] of [
    ["v2_enabled", true],
    ["status", "open"],
    ["is_hidden", false],
  ])
    assert.ok(
      calls[0].ops.some(
        (x) => x[0] === "eq" && x[1] === field && x[2] === value,
      ),
    );
  assert.ok(
    calls[0].ops.some(
      (x) => x[0] === "is" && x[1] === "deleted_at" && x[2] === null,
    ),
  );
  assert.ok(calls[0].ops.some((x) => x[0] === "gt" && x[1] === "expires_at"));
  ok("Active catalog excludes legacy, hidden, deleted and elapsed rooms");
  assert.ok(
    calls.every(
      (x) =>
        !x.ops ||
        x.ops
          .filter((o) => o[0] === "select")
          .every(
            (o) =>
              !o[1].includes("*") &&
              !o[1].includes("email") &&
              !o[1].includes("core_invite"),
          ),
    ),
  );
  ok("Only allowlisted columns are selected");
  snapshots = [
    {
      room_id: "id0",
      title: "Snapshot title",
      description: "Snapshot description",
      published_at: "2026-10-23",
      blocks: [],
    },
  ];
  const w = await get("?mode=works");
  assert.equal(w.body.rooms[0].title, "Snapshot title");
  assert.equal(w.body.rooms[0].concept, "Snapshot description");
  ok("Published card uses immutable snapshot text");
  fail = { message: "PRIVATE DATABASE SENTINEL" };
  const e = await get();
  assert.equal(e.status, 503);
  assert.ok(!JSON.stringify(e).includes("SENTINEL"));
  ok("Database diagnostics never enter response");
  function contrast(a, b) {
    const luminance = (x) => {
      const v = x
        .match(/\w\w/g)
        .map((n) => parseInt(n, 16) / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    const l = [luminance(a), luminance(b)].sort((a, b) => b - a);
    return (l[0] + 0.05) / (l[1] + 0.05);
  }
  for (const [a, b, name] of [
    ["2456df", "ffffff", "primary"],
    ["16734b", "eaf6ef", "active"],
    ["5d6574", "f7f8fa", "muted"],
    ["b42338", "fff0f1", "danger"],
  ]) {
    assert.ok(contrast(a, b) >= 4.5);
    ok("WCAG AA text contrast " + name);
  }
  out.complete = true;
  fs.writeFileSync(
    "docs/v2-3-unit-result.json",
    JSON.stringify(out, null, 2) + "\n",
  );
  console.log(JSON.stringify({ passed: out.checks.length }));
})().catch(() => {
  console.error("UI_UNIT_FAILED");
  process.exitCode = 1;
});
