/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic staging lifecycle UI checks. */
const fs = require("fs"),
  assert = require("node:assert/strict");
(async () => {
  let h,
    phase = "setup";
  const out = { checks: [], complete: false, productionChanges: "NONE" },
    save = () =>
      fs.writeFileSync(
        "docs/v2-3-" + (h?.hosted ? "preview-" : "") + "actions-result.json",
        JSON.stringify(out, null, 2) + "\n",
      ),
    ok = (name) => {
      out.checks.push({ name, pass: true });
      save();
      console.log("PASS " + name);
    };
  try {
    h = await require("./harness.cjs")();
    phase = "create";
    const auxIndex = h.hosted ? 8 : 7,
      p = await h.page(h.old.users[auxIndex]);
    await p.goto(h.base + "/rooms/create");
    await p
      .getByLabel("タイトル", { exact: true })
      .fill("TEST 余白からはじめる短編");
    await p
      .getByLabel("何をつくりたい？", { exact: true })
      .fill(
        "これは合成ユーザーだけで制作する架空の短編です。町の小さな発見を一緒に集めます。",
      );
    await p.getByLabel("定員", { exact: true }).selectOption("5");
    await p.getByLabel("制作期間", { exact: true }).selectOption("6");
    await p.getByRole("radio", { name: /AI禁止/ }).check();
    assert.ok(
      await p
        .getByRole("button", { name: "ルームを作る", exact: true })
        .isDisabled(),
    );
    await p.getByRole("checkbox").check();
    const response = p.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/v2/create" &&
        r.request().method() === "POST",
    );
    await p.getByRole("button", { name: "ルームを作る", exact: true }).click();
    const created = await response;
    assert.equal(created.status(), 200, "CREATE_RESPONSE");
    const body = await created.json();
    assert.match(body.data, /^[a-f0-9-]{36}$/);
    await p.waitForURL((url) => url.pathname === "/rooms/" + body.data, {
      waitUntil: "domcontentloaded",
    });
    await p
      .getByRole("heading", { name: "TEST 余白からはじめる短編", exact: true })
      .waitFor();
    ok("Stable build: create submit transitions to the created room");
    h.f.navigationRoom = body.data;
    fs.writeFileSync(".staging-private/v23-e2e.json", JSON.stringify(h.f));
    phase = "mobile post";
    const owner = await h.page(h.f.users[0]);
    await owner.setViewportSize({ width: 320, height: 850 });
    await owner.goto(h.base + "/rooms/" + h.f.room);
    await owner
      .getByLabel("制作ログに投稿", { exact: true })
      .fill("TEST スマートフォンの幅でも投稿できます。");
    const png = await require("sharp")({
      create: { width: 16, height: 16, channels: 3, background: "#2456df" },
    })
      .png()
      .toBuffer();
    await owner
      .locator("input[type=file]")
      .setInputFiles({
        name: "synthetic.png",
        mimeType: "image/png",
        buffer: png,
      });
    await owner.getByRole("button", { name: "投稿する", exact: true }).click();
    await owner.getByText("投稿しました。", { exact: true }).waitFor();
    await owner.getByLabel("本文・投稿者を検索").fill("スマートフォン");
    await owner.getByRole("button", { name: "検索", exact: true }).click();
    await owner.getByLabel("表示する投稿").selectOption("image");
    const img = owner.getByAltText("制作ログの添付画像").first();
    await img.waitFor();
    await img.evaluate((e) => e.decode());
    assert.ok(await img.evaluate((e) => e.naturalWidth === 16));
    ok("320px composer posts and displays genuine synthetic image bytes");
    phase = "Core resignation";
    const core = await h.page(h.f.users[2]);
    await core.setViewportSize({ width: 390, height: 850 });
    await core.goto(h.base + "/rooms/" + h.f.room);
    await core.getByRole("button", { name: "メンバー", exact: true }).click();
    const resign = core.getByRole("button", {
      name: "Coreを辞退する",
      exact: true,
    });
    await resign.waitFor();
    await resign.click();
    await core
      .getByRole("button", { name: "Core辞退は承認待ち", exact: true })
      .waitFor();
    await owner.getByRole("button", { name: "メンバー", exact: true }).click();
    const approve = owner.getByRole("button", {
      name: "辞退を承認",
      exact: true,
    });
    await approve.waitFor();
    await approve.click();
    await approve.waitFor({ state: "hidden" });
    await core.reload();
    await core.getByRole("button", { name: "メンバー", exact: true }).click();
    await core
      .getByRole("button", { name: "Coreに応募する", exact: true })
      .waitFor();
    ok("Core resignation requires Creator approval and returns to Member");
    phase = "kick";
    await p.goto(h.base + "/rooms/" + h.f.room);
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
      await p.locator("header").getByRole("checkbox").check();
      await join.click();
      await p.getByLabel("制作ログに投稿", { exact: true }).waitFor();
    }
    await owner.reload();
    await owner.getByRole("button", { name: "メンバー", exact: true }).click();
    const targetId = h.old.users[auxIndex].id;
    // Match only the synthetic actor's Creator-visible name fetched through the authorized state API.
    const { createClient } = require("@supabase/supabase-js"),
      c = createClient(h.ctx.url, h.ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      login = await c.auth.signInWithPassword({
        email: h.f.users[0].email,
        password: h.f.users[0].password,
      });
    assert.ok(!login.error);
    const state = await c.rpc("v2_room_state", { p_room: h.f.room });
    assert.ok(!state.error);
    const target = state.data.members.find((m) => m.user_id === targetId);
    assert.ok(target);
    const index = state.data.members
      .filter((m) => m.role !== "creator")
      .findIndex((m) => m.user_id === targetId);
    assert.ok(index >= 0);
    await owner
      .getByRole("button", { name: "ルームから外す", exact: true })
      .nth(index)
      .click();
    await owner
      .getByRole("dialog")
      .getByText(/このメンバーをルームから外しますか/)
      .waitFor();
    await owner
      .getByRole("button", { name: "確認して実行", exact: true })
      .click();
    await owner.getByRole("dialog").waitFor({ state: "hidden" });
    await p.reload();
    await p
      .getByText("このルームには再参加できません。", { exact: true })
      .first()
      .waitFor();
    assert.equal(
      await p.getByRole("button", { name: "投稿する", exact: true }).count(),
      0,
    );
    ok("Creator confirms removal; excluded Member cannot rejoin or post");
    assert.equal(h.errors.length, 0);
    assert.equal(h.http500.length, 0);
    out.complete = true;
    save();
  } catch (e) {
    out.failure = {
      phase,
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
