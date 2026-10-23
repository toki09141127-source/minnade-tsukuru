import "server-only";
import {
  AI_LIMITS,
  OUTPUT_SCHEMA,
  providerRequest,
  validateOutput,
  type AiTask,
  type AiOutput,
} from "./safety";
export type AiUsage = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};
export interface AiProvider {
  generate(task: AiTask): Promise<{ output: AiOutput; usage: AiUsage }>;
}
export class AiProviderError extends Error {
  constructor(
    public code: string,
    public httpStatus?: number,
    public providerCode?: string,
  ) {
    super(code);
  }
}
export class OpenAiProvider implements AiProvider {
  constructor(
    private key: string,
    private model = "gpt-4.1-mini-2025-04-14",
  ) {}
  async generate(task: AiTask) {
    const request = providerRequest(task),
      started = Date.now();
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: AbortSignal.timeout(AI_LIMITS.timeoutMs),
        headers: {
          Authorization: "Bearer " + this.key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          store: false,
          instructions: request.instructions,
          input: request.input,
          max_output_tokens: AI_LIMITS.maxOutputTokens,
          text: {
            format: {
              type: "json_schema",
              name: "room_assistance",
              strict: true,
              schema: OUTPUT_SCHEMA,
            },
          },
        }),
      });
    } catch {
      throw new AiProviderError("PROVIDER_TIMEOUT");
    }
    if (!response.ok) {
      let code = "";
      try {
        const e = await response.json();
        const candidate = e?.error?.code || e?.error?.type;
        code = [
          "insufficient_quota",
          "rate_limit_exceeded",
          "invalid_api_key",
          "model_not_found",
          "billing_hard_limit_reached",
          "invalid_json_schema",
          "invalid_request_error",
        ].includes(candidate)
          ? candidate
          : "unknown";
      } catch {}
      throw new AiProviderError(
        ["insufficient_quota", "billing_hard_limit_reached"].includes(code)
          ? "PROVIDER_QUOTA"
          : response.status === 429 && code === "rate_limit_exceeded"
            ? "PROVIDER_RATE"
            : "PROVIDER_UNAVAILABLE",
        response.status,
        code,
      );
    }
    // Raw provider errors, prompts, request IDs and responses are never logged.
    const raw = await response.text();
    if (raw.length > 150000) throw new AiProviderError("INVALID_OUTPUT");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AiProviderError("INVALID_OUTPUT");
    }
    if (body.status !== "completed" || !Array.isArray(body.output))
      throw new AiProviderError("INVALID_OUTPUT");
    const texts: string[] = [];
    for (const entry of body.output) {
      if (entry.type === "message" && Array.isArray(entry.content))
        for (const c of entry.content) {
          if (c.type === "refusal") throw new AiProviderError("UNSAFE_OUTPUT");
          if (c.type === "output_text" && typeof c.text === "string")
            texts.push(c.text);
        }
    }
    let output: AiOutput;
    try {
      output = validateOutput(
        JSON.parse(texts.join("")),
        task.context,
        task.kind,
      );
    } catch {
      throw new AiProviderError("INVALID_OUTPUT");
    }
    const token = (v: unknown) =>
      typeof v === "number" && Number.isSafeInteger(v) && v >= 0
        ? Math.min(v, 1000000)
        : 0;
    return {
      output,
      usage: {
        provider: "openai",
        model: this.model,
        inputTokens: token(body.usage?.input_tokens),
        outputTokens: token(body.usage?.output_tokens),
        durationMs: Date.now() - started,
      },
    };
  }
}
/** Synthetic provider is available only locally or in the explicitly opted-in staging RC Preview. */
export class SyntheticProvider implements AiProvider {
  async generate(task: AiTask) {
    providerRequest(task);
    const post = task.context.posts[0];
    const output = validateOutput(
      {
        message:
          task.trigger === "greeting"
            ? "このルームのAI Creatorです。人間の制作を整理し、必要なときだけお手伝いします。"
            : "提案：今ある内容を確認し、次の一歩を相談しましょう。",
        unresolved: post
          ? [
              {
                text: "提案：次に取り組む箇所を相談しましょう。",
                refs: [post.ref],
              },
            ]
          : [],
        nextActions: [],
        highlightNotes: task.context.posts
          .filter((p) => p.highlight)
          .slice(0, 3)
          .map((p) => ({
            text: "重要候補です。決定事項かどうかを人間が確認してください。",
            refs: [p.ref],
          })),
        draftText:
          task.kind === "draft_assist"
            ? "提案：" + (post?.text ?? task.context.description)
            : "",
      },
      task.context,
      task.kind,
    );
    return {
      output,
      usage: {
        provider: "synthetic",
        model: "deterministic-v1",
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
      },
    };
  }
}
export function aiConfigured() {
  return (
    process.env.AI_ENABLED === "true" &&
    ((process.env.AI_PROVIDER === "openai" && !!process.env.OPENAI_API_KEY) ||
      (process.env.AI_PROVIDER === "synthetic" &&
        process.env.STAGING_TEST === "true" &&
        (!process.env.VERCEL ||
          (process.env.VERCEL_ENV === "preview" &&
            process.env.V2_RC_SYNTHETIC_AI === "true" &&
            process.env.NEXT_PUBLIC_SUPABASE_URL ===
              "https://fwqucffxdmbdczspkcyr.supabase.co"))))
  );
}
export function getAiProvider(
  tier: "cheap" | "standard" | "premium" = "cheap",
): AiProvider {
  if (!aiConfigured()) throw new AiProviderError("AI_STOPPED");
  if (process.env.AI_PROVIDER === "synthetic") return new SyntheticProvider();
  return new OpenAiProvider(
    process.env.OPENAI_API_KEY!,
    process.env["AI_MODEL_" + tier.toUpperCase()] ||
      process.env.AI_MODEL ||
      "gpt-4.1-mini-2025-04-14",
  );
}
