import { resumeAccountDeletion } from "@/lib/accountDeletion";
import { createAccountDeletionPorts } from "@/lib/accountDeletionAdapter";
import { createFinalDeletionPreparation } from "@/lib/accountDeletionPreparation";
import { limitAction } from "@/lib/apiGuards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!jwt) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401, headers },
      );
    }
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401, headers },
      );
    }

    if (process.env.MVP_ACCOUNT_REQUESTS_ENABLED === "true") {
      const limited = await limitAction(supabaseAdmin, data.user.id, "account");
      if (limited) return limited;
      const body = await req.json().catch(() => ({}));
      if (
        body.confirm !== true ||
        body.attribution !== "anonymous" ||
        body.policyVersion !== "withdrawal-draft-2026-10-21"
      ) {
        return NextResponse.json(
          { ok: false, error: "保持・名義の説明を確認してください" },
          { status: 400, headers },
        );
      }
      const { data: requestId, error: requestError } = await supabaseAdmin.rpc(
        "mvp_request_deletion",
        {
          p_actor: data.user.id,
          p_attribution: body.attribution,
          p_policy: body.policyVersion,
        },
      );
      if (requestError?.message === "DELETION_PAUSED")
        return NextResponse.json(
          { ok: false, error: "退会処理は安全確認のため一時停止中です" },
          { status: 503, headers },
        );
      if (requestError?.message === "UNPUBLISHED_CREATOR_ROOMS")
        return NextResponse.json(
          {
            ok: false,
            code: "UNPUBLISHED_CREATOR_ROOMS",
            error: "公開前のルームを削除してから退会してください",
          },
          { status: 409, headers },
        );
      if (requestError?.message === "ACTIVE_CORE_ROOMS")
        return NextResponse.json(
          {
            ok: false,
            code: "ACTIVE_CORE_ROOMS",
            error:
              "制作中のCoreとして参加しています。Creatorに降格を依頼するか、作品の公開後に退会してください",
          },
          { status: 409, headers },
        );
      if (requestError || typeof requestId !== "string")
        return NextResponse.json(
          { ok: false, error: "申請を確認できませんでした" },
          { status: 503, headers },
        );
      // The job ID comes exclusively from the actor-bound intake RPC.
      if (process.env.MVP_ACCOUNT_FINALIZE_ENABLED === "true") {
        const state = await resumeAccountDeletion(
          requestId,
          createAccountDeletionPorts(
            supabaseAdmin,
            createFinalDeletionPreparation(supabaseAdmin, async (job) => {
                const { prepareBillingDeletion } = await import(
                  "@/lib/billing/deletion"
                );
                await prepareBillingDeletion(supabaseAdmin, job);
            }),
          ),
        );
        const completed = state === "completed";
        return NextResponse.json(
          { ok: true, requestId, state, completed },
          { status: completed ? 200 : 202, headers },
        );
      }
      return NextResponse.json(
        { ok: true, requestId, state: "requested", completed: false },
        { status: 202, headers },
      );
    }

    // The former profile-update/Auth-delete sequence cannot safely resume after failure.
    // Do not enable deletion until retention, FK/trigger effects and durable recovery are verified.
    // This response does not register a withdrawal request.
    return NextResponse.json(
      {
        ok: false,
        code: "ACCOUNT_DELETION_UNAVAILABLE",
        error:
          "安全な退会処理を準備中のため、現在は退会できません。この操作では退会申請は受け付けていません。",
      },
      { status: 503, headers },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "退会処理を開始できませんでした" },
      { status: 503, headers },
    );
  }
}

export async function GET() {
  const enabled = process.env.MVP_ACCOUNT_REQUESTS_ENABLED === "true";
  const state = enabled
    ? await supabaseAdmin.rpc("mvp_deletion_is_paused")
    : null;
  return NextResponse.json(
    { enabled: enabled && !state?.error && state?.data === false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
