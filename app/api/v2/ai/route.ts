import { after, NextResponse } from "next/server";
import { v2Client, v2Enabled } from "@/lib/v2/server";
import { uuid, validBlocks } from "@/lib/v2/domain";
import { safeAiText } from "@/lib/ai/safety";
import { aiConfigured } from "@/lib/ai/provider";
import { runAiTask } from "@/lib/ai/worker";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const response = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
function failure(code: string) {
  const status =
    code === "AI_UNAVAILABLE"
      ? 503
      : code === "RATE_LIMITED"
        ? 429
        : code === "FORBIDDEN"
          ? 403
          : 409;
  const labels: Record<string, string> = {
    CREDITS_EXHAUSTED: "今月のAI利用枠を使い切りました。",
    PLAN_REQUIRED: "このAI処理はルームのプランで利用できません。",
    AI_UNAVAILABLE: "AIは現在利用できません。人間の制作は続けられます。",
    RATE_LIMITED: "AIの利用が続いています。少し時間を空けてください。",
    FORBIDDEN: "このAI操作は参加中のCreator/Core専用です。",
    CONFLICT:
      "ドラフトが更新されました。入力を残したまま最新版を確認してください。",
    UNSAFE_CONTENT:
      "個人情報・秘密情報・AIへの不正な指示を含めずに入力してください。",
  };
  return response(
    {
      error:
        labels[code] ??
        "AIの処理結果を確認できません。制作内容は保存されています。",
      code: code in labels ? code : "AI_FAILED",
    },
    status,
  );
}
export async function GET(req: Request) {
  if (!v2Enabled()) return failure("AI_UNAVAILABLE");
  const roomId = new URL(req.url).searchParams.get("roomId");
  if (!uuid(roomId))
    return response({ error: "ルームを確認してください。" }, 400);
  try {
    const r = await v2Client(req).rpc("v22_ai_state", { p_room: roomId });
    if (r.error) return failure(r.error.message);
    if (aiConfigured() && r.data?.identity)
      after(async () => {
        await runAiTask(roomId).catch(() => {});
      });
    return response({
      ...r.data,
      enabled: !!r.data?.enabled && aiConfigured(),
    });
  } catch {
    return failure("AI_UNAVAILABLE");
  }
}
export async function POST(req: Request) {
  if (!v2Enabled()) return failure("AI_UNAVAILABLE");
  try {
    const client = v2Client(req),
      auth = await client.auth.getUser();
    if (auth.error || !auth.data.user)
      return response({ error: "ログインしてください。" }, 401);
    const raw = await req.text();
    if (raw.length > 65000)
      return response({ error: "入力が大きすぎます。" }, 413);
    let b;
    try {
      b = JSON.parse(raw);
    } catch {
      return response({ error: "入力を確認してください。" }, 400);
    }
    if (!uuid(b.roomId))
      return response({ error: "ルームを確認してください。" }, 400);
    if (b.action === "accept") {
      if (
        !uuid(b.outputId) ||
        !Number.isInteger(b.version) ||
        b.version < 0 ||
        b.reviewed !== true ||
        !validBlocks(b.blocks)
      )
        return response(
          { error: "提案と公開する内容を確認してください。" },
          400,
        );
      const r = await client.rpc("v22_ai_accept", {
        p_room: b.roomId,
        p_output: b.outputId,
        p_version: b.version,
        p_blocks: b.blocks,
        p_reviewed: true,
      });
      return r.error
        ? failure(r.error.message)
        : response({ ok: true, version: r.data });
    }
    if (b.action === "hide") {
      if (!uuid(b.outputId))
        return response({ error: "対象を確認してください。" }, 400);
      const r = await client.rpc("v22_ai_hide", {
        p_room: b.roomId,
        p_output: b.outputId,
      });
      return r.error ? failure(r.error.message) : response({ ok: true });
    }
    if (!aiConfigured()) return failure("AI_UNAVAILABLE");
    if (
      !uuid(b.requestId) ||
      !["question", "idea", "organize", "summarize", "draft_assist"].includes(
        b.kind,
      ) ||
      !safeAiText(b.text ?? "", 1200)
    )
      return failure("UNSAFE_CONTENT");
    const r = await client.rpc("v24_ai_request", {
      p_room: b.roomId,
      p_request: b.requestId,
      p_class: b.taskClass ?? b.kind,
      p_text: b.text ?? "",
    });
    if (r.error) return failure(r.error.message);
    after(async () => {
      await runAiTask(b.roomId).catch(() => {});
    });
    return response({ ok: true, taskId: r.data }, 202);
  } catch {
    return failure("AI_UNAVAILABLE");
  }
}
