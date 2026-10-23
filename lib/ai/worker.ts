import "server-only";
import { createClient } from "@supabase/supabase-js";
import { v2Enabled } from "@/lib/v2/server";
import {
  aiConfigured,
  getAiProvider,
  AiProviderError,
  type AiProvider,
} from "./provider";
import { validateContext, type AiTask } from "./safety";
function workerClient() {
  if (!v2Enabled()) throw Error("STAGING_BOUNDARY");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function runAiTask(
  roomId: string | null = null,
  provider?: AiProvider,
): Promise<string> {
  if (!v2Enabled() || !aiConfigured()) return "disabled";
  const client = workerClient(),
    claim = await client.rpc("v22_ai_claim", { p_room: roomId });
  if (claim.error) return "unavailable";
  if (!claim.data) return "idle";
  const task = claim.data as AiTask;
  let output = null,
    usage = {},
    error: string | null = null;
  try {
    task.context = validateContext(task.context);
    if (!aiConfigured()) throw new AiProviderError("AI_STOPPED");
    const result = await (provider ?? getAiProvider(task.modelTier)).generate(
      task,
    );
    output = result.output;
    usage = result.usage;
    if (!aiConfigured()) {
      output = null;
      error = "AI_STOPPED";
    }
  } catch (e) {
    error = e instanceof AiProviderError ? e.code : "INVALID_OUTPUT";
  }
  const finish = await client.rpc("v22_ai_finish", {
    p_task: task.id,
    p_lease: task.lease,
    p_output: output,
    p_usage: usage,
    p_error: error,
  });
  return finish.error ? "unavailable" : String(finish.data);
}
export async function scheduleAi() {
  if (!v2Enabled() || !aiConfigured())
    return { scheduled: false, result: "disabled" };
  const r = await workerClient().rpc("v22_ai_schedule");
  if (r.error) return { scheduled: false, result: "unavailable" };
  return { scheduled: true, result: await runAiTask() };
}
