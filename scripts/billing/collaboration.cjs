/* eslint-disable @typescript-eslint/no-require-imports -- Node-only staging verification. */
const fs = require("fs"),
  crypto = require("crypto"),
  assert = require("node:assert/strict");
const ctx = require("../staging/safety.cjs").load(),
  { createClient } = require("@supabase/supabase-js");
Object.assign(process.env, ctx.env);
const hosted = process.argv.includes("--preview");
if (!hosted) require("../staging/web-network.cjs");
const old = JSON.parse(fs.readFileSync(".staging-private/v2-e2e.json")),
  ai = JSON.parse(fs.readFileSync(".staging-private/v22-e2e.json"));
assert.equal(old.projectRef, ctx.ref);
assert.equal(ai.projectRef, ctx.ref);
const stateFile = ".staging-private/v24-collaboration.json",
  state = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile))
    : {
        projectRef: ctx.ref,
        runId: crypto.randomUUID(),
        users: old.users.slice(4, 7),
      };
assert.equal(state.projectRef, ctx.ref);
const out = {
  scope: hosted
    ? "hosted staging Preview; synthetic users; no real AI"
    : "real staging; synthetic users; local browser; no real AI",
  checks: [],
  complete: false,
  productionChanges: "NONE",
  browserErrors: [],
  serverErrors: [],
};
const save = () => {
    fs.writeFileSync(stateFile, JSON.stringify(state));
    fs.writeFileSync(
      "docs/v2-4-collaboration-" +
        (hosted ? "preview-" : "") +
        "browser-result.json",
      JSON.stringify(out, null, 2) + "\n",
    );
  },
  ok = (name) => {
    out.checks.push({ name, pass: true });
    save();
    console.log("PASS " + name);
  };
let h,
  browser,
  phase = "setup";
(async () => {
  try {
    h = await require("./collaboration-harness.cjs")();
    const base = h.base;
    browser = h.browser;
    const access = hosted
      ? JSON.parse(fs.readFileSync(".staging-private/v24-preview-access.json"))
      : null;
    if (access) assert.equal(access.url, base);
    const clients = [];
    for (const u of state.users) {
      const c = createClient(ctx.url, ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const r = await c.auth.signInWithPassword({
        email: u.email,
        password: u.password,
      });
      assert.ok(!r.error, "SYNTHETIC_LOGIN");
      u.token = r.data.session.access_token;
      clients.push(c);
    }
    const api = async (i, route, body) => {
      const r = await fetch(base + route, {
        method: body ? "POST" : "GET",
        headers: {
          ...(i === null
            ? {}
            : { Authorization: "Bearer " + state.users[i].token }),
          "Content-Type": "application/json",
          ...(access
            ? {
                Cookie: access.cookies
                  .map((c) => c.name + "=" + c.value)
                  .join("; "),
              }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    };
    phase = "catalog";
    for (const mode of ["rooms", "works"]) {
      const r = await api(null, "/api/v2/catalog?mode=" + mode);
      assert.equal(r.status, 200, "CATALOG_" + mode);
      assert.ok(r.body.rooms.length <= 18);
      assert.ok(
        r.body.rooms.every(
          (x) => x.status === (mode === "rooms" ? "open" : "forced_publish"),
        ),
      );
      ok(
        "Caller-scoped " +
          mode +
          " catalog has correct status and bounded rows",
      );
    }
    assert.equal((await api(null, "/api/v2/catalog?mine=true")).status, 401);
    assert.equal(
      (await api(null, "/api/v2/catalog?mode=activity")).status,
      401,
    );
    ok("Anonymous My Page data rejected");
    assert.equal((await api(null, "/api/v2/catalog?page=-1")).status, 400);
    assert.equal((await api(null, "/api/v2/catalog?genre=bad")).status, 400);
    ok("Invalid catalog filters rejected");
    const setup = async () => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      if (access) await context.addCookies(access.cookies);
      const page = await context.newPage();
      await page.route("**/*", (r) =>
        [base, ctx.url].includes(new URL(r.request().url()).origin)
          ? r.continue()
          : r.abort(),
      );
      page.on("framenavigated", (f) => {
        if (f === page.mainFrame()) {
          out.navigation ??= [];
          out.navigation.push(new URL(f.url()).pathname);
        }
      });
      page.on("pageerror", (e) =>
        out.browserErrors.push(
          String(e.message)
            .replace(/https?:\/\/\S+/g, "[URL]")
            .slice(0, 100),
        ),
      );
      page.on("response", (r) => {
        if (r.status() >= 500)
          out.serverErrors.push({
            path: new URL(r.url()).pathname,
            status: r.status(),
          });
      });
      return page;
    };
    const anon = await setup();
    await anon.goto(base + "/");
    await anon.getByRole("heading", { name: /つくりたい人/ }).waitFor();
    ok("Home brand and primary actions rendered");
    await anon
      .getByRole("link", { name: "制作中のルームを見る ↗", exact: true })
      .click();
    await anon
      .getByRole("heading", { name: "ルームを探す", exact: true })
      .waitFor();
    await anon.getByLabel("キーワード").fill("TEST");
    await anon.getByLabel("ジャンル", { exact: true }).selectOption("novel");
    await anon.getByLabel("AI Creator", { exact: true }).selectOption("assist");
    await anon.getByLabel("並び順").selectOption("deadline");
    ok("Room discovery search, genre, AI and deadline controls operate");
    await anon.goto(base + "/works/" + ai.extra.publication);
    await anon
      .getByRole("link", { name: "この作品ができるまで", exact: true })
      .waitFor();
    await anon
      .getByRole("link", { name: "この作品ができるまで", exact: true })
      .click();
    await anon
      .getByRole("heading", { name: "公開制作ログ", exact: true })
      .waitFor();
    assert.equal(
      await anon.getByRole("button", { name: "投稿する", exact: true }).count(),
      0,
    );
    ok("Anonymous Work opens read-only public production log");
    const login = async (i) => {
      const p = await setup();
      await p.goto(base + "/login");
      await p.locator("input[type=email]").fill(state.users[i].email);
      await p.locator("input[type=password]").fill(state.users[i].password);
      await p.getByRole("button", { name: "ログイン", exact: true }).click();
      await p.waitForURL(base + "/");
      return p;
    };
    const owner = await login(0),
      member = await login(1),
      core = await login(2);
    ok("Creator, Core candidate and Member login through UI");
    phase = "create";
    if (!state.room) {
      const existing = await api(
        0,
        "/api/v2/catalog?q=" +
          encodeURIComponent("TEST みんなで描く、朝の物語"),
      );
      const match = existing.body.rooms?.find((r) => r.myRole === "creator");
      if (match) {
        state.room = match.id;
        save();
      }
    }
    if (!state.room) {
      await owner.goto(base + "/rooms/create");
      await owner
        .getByLabel("タイトル", { exact: true })
        .fill("TEST みんなで描く、朝の物語");
      await owner
        .getByLabel("何をつくりたい？", { exact: true })
        .fill(
          "架空の町に暮らす仲間たちの、小さな発見を一緒に描く短い物語を制作します。",
        );
      await owner.getByLabel("定員", { exact: true }).selectOption("10");
      await owner.getByLabel("制作期間", { exact: true }).selectOption("48");
      await owner.getByRole("radio", { name: /AI補助可/ }).check();
      await owner.getByRole("checkbox").check();
      await owner
        .getByRole("button", { name: "ルームを作る", exact: true })
        .click();
      await owner.waitForURL(/\/rooms\/[0-9a-f-]{36}$/, {
        timeout: 60000,
        waitUntil: "domcontentloaded",
      });
      state.room = new URL(owner.url()).pathname.split("/").pop();
      save();
    }
    await owner.goto(base + "/rooms/" + state.room);
    await owner
      .getByRole("heading", {
        name: "TEST みんなで描く、朝の物語",
        exact: true,
      })
      .waitFor();
    ok(
      "Creator opens room created through consent UI; navigation separately verified",
    );
    for (const p of [member, core]) {
      await p.goto(base + "/rooms/" + state.room);
      await p
        .getByRole("heading", {
          name: "TEST みんなで描く、朝の物語",
          exact: true,
        })
        .waitFor();
      const join = p
        .getByRole("button", { name: "Memberとして参加", exact: true })
        .first();
      if (await join.isVisible()) {
        assert.ok(await join.isDisabled());
        await p.locator("header").getByRole("checkbox").check();
        await join.click();
      }
      await p.getByLabel("制作ログに投稿", { exact: true }).waitFor();
    }
    ok("Member join requires consent and unlocks composer");
    phase = "post";
    await member
      .getByLabel("制作ログに投稿", { exact: true })
      .fill("TEST みんなで朝の場面を考えました。");
    await member.getByRole("button", { name: "投稿する", exact: true }).click();
    await member.getByText("投稿しました。", { exact: true }).waitFor();
    await member.getByLabel("本文・投稿者を検索").fill("朝の場面");
    await member.getByRole("button", { name: "検索", exact: true }).click();
    await member.getByLabel("表示する投稿").selectOption("mine");
    await member
      .getByText("TEST みんなで朝の場面を考えました。", { exact: true })
      .first()
      .waitFor();
    ok("Member posts and searches own production log");
    phase = "core approval";
    await core.getByRole("button", { name: "メンバー", exact: true }).click();
    const apply = core.getByRole("button", {
      name: "Coreに応募する",
      exact: true,
    });
    if (await apply.isVisible()) {
      await core.locator("aside").getByRole("checkbox").check();
      await apply.click();
      await core
        .getByRole("button", { name: "Core申請は審査待ち", exact: true })
        .waitFor();
    }
    await owner.reload();
    await owner.getByRole("button", { name: "メンバー", exact: true }).click();
    const approve = owner.getByRole("button", {
      name: "Coreへ承認",
      exact: true,
    });
    await owner.waitForTimeout(1000);
    if (await approve.count()) {
      await approve.first().click();
      await approve.first().waitFor({ state: "hidden" });
    }
    await core.reload();
    await core
      .getByRole("button", { name: "AIに聞く ↗", exact: true })
      .waitFor();
    ok("Member requests Core and Creator approves through UI");
    const forbidden = await api(1, "/api/v2/member", {
      roomId: state.room,
      action: "kick",
      target: state.users[2].id,
    });
    assert.equal(forbidden.status, 403);
    ok("Member cannot invoke Creator operation directly");
    phase = "highlight";
    await owner.reload();
    await owner.getByLabel("本文・投稿者を検索").fill("朝の場面");
    await owner.getByRole("button", { name: "検索", exact: true }).click();
    const article = owner
      .locator("article")
      .filter({ hasText: "TEST みんなで朝の場面を考えました。" })
      .first();
    await article.waitFor();
    if (
      await article
        .getByRole("button", { name: "ハイライト", exact: true })
        .isVisible()
    )
      await article
        .getByRole("button", { name: "ハイライト", exact: true })
        .click();
    await article
      .getByRole("button", { name: "ハイライト解除", exact: true })
      .waitFor();
    if (
      await article
        .getByRole("button", { name: "公開制作ログから除外", exact: true })
        .isVisible()
    )
      await article
        .getByRole("button", { name: "公開制作ログから除外", exact: true })
        .click();
    await article.getByText("公開制作ログから除外", { exact: true }).waitFor();
    ok("Creator highlights and excludes with distinct state");
    phase = "draft";
    await owner
      .getByRole("button", { name: "完成作品ドラフト", exact: true })
      .click();
    await owner.getByLabel("追加するブロック").selectOption("text");
    await owner
      .getByRole("button", { name: "ブロックを追加", exact: true })
      .click();
    await owner
      .getByLabel("本文の内容", { exact: true })
      .last()
      .fill("TEST 仲間と一緒に作った物語です。");
    await owner
      .getByLabel("個人情報・権利・公開する内容を確認しました", { exact: true })
      .check();
    await owner
      .getByRole("button", { name: "完成作品ドラフトを保存", exact: true })
      .click();
    await owner
      .locator("section")
      .filter({
        has: owner.getByRole("heading", {
          name: "完成作品ドラフト",
          exact: true,
        }),
      })
      .getByText("保存しました。", { exact: true })
      .waitFor();
    ok("Creator edits, previews and saves reviewed draft");
    phase = "conflict";
    await core
      .getByRole("button", { name: "完成作品ドラフト", exact: true })
      .click();
    await core
      .getByLabel("本文の内容", { exact: true })
      .first()
      .fill("TEST 入力を競合時にも保持します。");
    await core
      .getByLabel("個人情報・権利・公開する内容を確認しました", { exact: true })
      .check();
    await core
      .getByRole("button", { name: "完成作品ドラフトを保存", exact: true })
      .click();
    await core.getByText(/他の人が編集しました/).waitFor();
    assert.equal(
      await core.getByLabel("本文の内容", { exact: true }).first().inputValue(),
      "TEST 入力を競合時にも保持します。",
    );
    ok("Concurrent draft 409 preserves typed input");
    phase = "AI";
    await owner
      .getByRole("button", { name: "AIに聞く ↗", exact: true })
      .click();
    await owner
      .getByText(
        "AIは現在停止中です。人間の投稿・ドラフト編集は続けられます。",
        { exact: true },
      )
      .waitFor();
    assert.ok(
      await owner
        .getByRole("button", { name: "AIに依頼する", exact: true })
        .isDisabled(),
    );
    ok("AI stop leaves human creation intact");
    phase = "My Page";
    await member.goto(base + "/mypage");
    await member
      .getByRole("button", { name: "申請・通知", exact: true })
      .click();
    await member
      .getByRole("button", { name: "プロフィール・設定", exact: true })
      .click();
    await member
      .getByRole("link", { name: "プロフィール・設定を開く", exact: true })
      .waitFor();
    ok("My Page tabs and profile navigation operate");
    phase = "responsive";
    const pages = [
      ["home", "/"],
      ["rooms", "/rooms"],
      ["create", "/rooms/create"],
      ["room", "/rooms/" + state.room],
      ["works", "/works"],
      ["work", "/works/" + ai.extra.publication],
      ["log", "/works/" + ai.extra.publication + "/log"],
      ["mypage", "/mypage"],
    ];
    for (const [name, url] of pages) {
      await owner.goto(base + url);
      await owner.locator("h1").first().waitFor();
      await owner.waitForTimeout(700);
      for (const width of [320, 375, 390, 768, 1024, 1440]) {
        await owner.setViewportSize({ width, height: 900 });
        assert.ok(
          await owner.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "OVERFLOW_" + name + "_" + width,
        );
        if ([320, 375, 390, 1440].includes(width))
          await owner.screenshot({
            path:
              ".staging-private/v23-" +
              (hosted ? "preview-" : "") +
              name +
              "-" +
              width +
              ".png",
            fullPage: true,
          });
      }
      ok(name + " fits all six widths");
    }
    phase = "keyboard";
    await owner.goto(base + "/rooms/" + state.room);
    await owner.setViewportSize({ width: 1440, height: 900 });
    await owner.getByRole("button", { name: "メンバー", exact: true }).click();
    await owner
      .getByRole("button", { name: "ルームから外す", exact: true })
      .first()
      .click();
    assert.ok(await owner.getByRole("dialog").isVisible());
    assert.ok(
      await owner
        .getByRole("button", { name: "キャンセル", exact: true })
        .evaluate((e) => e === document.activeElement),
    );
    await owner.keyboard.press("Escape");
    assert.equal(await owner.getByRole("dialog").isVisible(), false);
    ok("Dangerous action dialog focuses cancel and Escape safely closes");
    assert.equal(out.browserErrors.length, 0, "NO_UNCAUGHT");
    assert.equal(out.serverErrors.length, 0, "NO_HTTP_500");
    ok("No uncaught browser error or HTTP 500");
    out.complete = true;
    save();
  } catch (e) {
    if (browser) {
      out.pages = [];
      let i = 0;
      for (const c of browser.contexts())
        for (const p of c.pages()) {
          await p
            .screenshot({
              path:
                ".staging-private/v24-collaboration-failure-" + i++ + ".png",
              fullPage: true,
            })
            .catch(() => {});
          out.pages.push({
            path: new URL(p.url()).pathname,
            headings: await p.locator("h1").allTextContents(),
            alerts: await p.locator("[role=alert]").allTextContents(),
          });
        }
    }
    out.failure = {
      phase,
      code: String(e.code || "CHECK_FAILED"),
      message: String(e.message)
        .replace(/https?:\/\/\S+/g, "[URL]")
        .slice(0, 200),
    };
    save();
    console.log(JSON.stringify(out.failure));
    process.exitCode = 1;
  } finally {
    if (h) await h.close();
  }
})();
