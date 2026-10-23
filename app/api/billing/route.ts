import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { v2Client } from "@/lib/v2/server";
import { billingBoundary, billingEnabled, rpc } from "@/lib/billing/server";
import { StripeTestProvider } from "@/lib/billing/stripe";
import { executeBilling } from "@/lib/billing/service";
import { BillingError, uuid, validSelection } from "@/lib/billing/domain";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const messages: Record<string, string> = {
  BILLING_BUSY:
    "別の決済処理を確認中です。少し待って同じ操作を再確認してください。",
  BILLING_DISABLED: "テスト決済は準備中です。無料の制作は続けられます。",
  PLAN_REQUIRED: "この設定は現在のプランでは編集できません。",
  PROFILE_LIMIT: "保存できるAIプロフィールは5件までです。",
  REQUEST_CONFLICT: "操作内容が変わりました。画面を更新して確認してください。",
  CONFLICT: "設定が更新されました。再読込して確認してください。",
  CHECKOUT_OPEN:
    "手続き中のCheckoutがあります。元の手続きを完了するか、期限後に同じ操作を再確認してください。",
  SUBSCRIPTION_EXISTS: "既に契約があります。変更操作を利用してください。",
  CHANGE_ALREADY_SCHEDULED:
    "次回変更が予約されています。解約取消で予約を取り消してから変更してください。",
};
function fail(code: string) {
  return reply(
    {
      error:
        messages[code] ??
        "処理結果を確認できませんでした。同じ操作の再確認か、少し待って再読込してください。",
      code: code in messages ? code : "BILLING_UNAVAILABLE",
    },
    code === "BILLING_DISABLED" ? 503 : 409,
  );
}
export async function GET(req: Request) {
  if (!billingBoundary()) return fail("BILLING_DISABLED");
  try {
    const client = v2Client(req),
      u = new URL(req.url),
      action = u.searchParams.get("action");
    if (action === "plans") {
      const r = await client.rpc("v24_plans");
      return r.error
        ? fail("BILLING_UNAVAILABLE")
        : reply({ config: r.data, paymentsEnabled: billingEnabled() });
    }
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user)
      return reply({ error: "ログインしてください。" }, 401);
    const room = u.searchParams.get("roomId");
    if (room !== null && !uuid(room)) return fail("INVALID_INPUT");
    const r = room
      ? await client.rpc("v24_room_billing", { p_room: room })
      : await client.rpc("v24_billing_state");
    return r.error ? fail(r.error.message) : reply(r.data);
  } catch {
    return fail("BILLING_UNAVAILABLE");
  }
}
export async function POST(req: Request) {
  if (!billingBoundary()) return fail("BILLING_DISABLED");
  try {
    const client = v2Client(req),
      auth = await client.auth.getUser();
    if (auth.error || !auth.data.user)
      return reply({ error: "ログインしてください。" }, 401);
    const raw = await req.text();
    if (raw.length > 10000)
      return reply({ error: "入力が大きすぎます。" }, 413);
    const b = JSON.parse(raw);
    if (b.action === "settings") {
      if (!uuid(b.roomId)) return fail("INVALID_INPUT");
      const r = await client.rpc("v24_save_settings", {
        p_room: b.roomId,
        p_settings: b.settings,
      });
      return r.error ? fail(r.error.message) : reply({ ok: true });
    }
    if (b.action === "profile" || b.action === "delete_profile") {
      if (!uuid(b.id) || !Number.isInteger(b.version))
        return fail("INVALID_INPUT");
      const r =
        b.action === "profile"
          ? await client.rpc("v24_save_profile", {
              p_id: b.id,
              p_name: b.name,
              p_settings: b.settings,
              p_version: b.version,
            })
          : await client.rpc("v24_delete_profile", {
              p_id: b.id,
              p_version: b.version,
            });
      return r.error ? fail(r.error.message) : reply({ ok: true });
    }
    if (!billingEnabled()) return fail("BILLING_DISABLED");
    if (
      !uuid(b.requestId) ||
      !["checkout", "change", "cancel", "resume", "portal"].includes(
        b.action,
      ) ||
      (["checkout", "change"].includes(b.action) &&
        !validSelection(b.plan, b.cycle))
    )
      return fail("INVALID_INPUT");
    const selected = {
      action: b.action,
      plan: b.plan ?? null,
      cycle: b.cycle ?? null,
    };
    const r = await client.rpc("v24_billing_start", {
      p_plan: selected.plan,
      p_cycle: selected.cycle,
      p_request: b.requestId,
      p_kind: b.action,
      p_hash: createHash("sha256")
        .update(JSON.stringify(selected))
        .digest("hex"),
    });
    if (r.error) return fail(r.error.message);
    try {
      return reply(
        await executeBilling(new StripeTestProvider(), b.requestId, selected),
      );
    } catch (e) {
      if (
        e instanceof BillingError &&
        [
          "PRICE_UNAVAILABLE",
          "PRICE_CONFIG_MISMATCH",
          "CHECKOUT_OPEN",
          "SUBSCRIPTION_EXISTS",
          "CHANGE_ALREADY_SCHEDULED",
          "PAYMENT_PENDING",
          "SUBSCRIPTION_REQUIRED",
          "PORTAL_UNAVAILABLE",
          "PORTAL_UNSAFE",
        ].includes(e.code)
      )
        await rpc("v24_operation_reject", {
          p_request: b.requestId,
          p_code: e.code,
        });
      throw e;
    }
  } catch (e) {
    return fail(e instanceof BillingError ? e.code : "BILLING_UNAVAILABLE");
  }
}
