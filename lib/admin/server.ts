import "server-only";
import { v2Enabled, v2Client } from "@/lib/v2/server";
import { NextResponse } from "next/server";
import { billingAdmin } from "@/lib/billing/server";
export const adminEnabled = () =>
  v2Enabled() &&
  process.env.VERCEL_ENV !== "production" &&
  process.env.ADMIN_ENABLED === "true";
export const adminJson = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function adminCaller(req: Request) {
  if (!adminEnabled())
    return { response: adminJson({ error: "ADMIN_UNAVAILABLE" }, 503) };
  if (!/^Bearer [^\s]+$/.test(req.headers.get("authorization") || ""))
    return { response: adminJson({ error: "LOGIN_REQUIRED" }, 401) };
  const client = v2Client(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    return { response: adminJson({ error: "LOGIN_REQUIRED" }, 401) };
  return { client };
}
export function adminStatus(error: string) {
  return error === "ADMIN_RATE_LIMITED"
    ? 429
    : ["ADMIN_FORBIDDEN", "OWNER_REQUIRED", "RECENT_LOGIN_REQUIRED"].includes(
          error,
        )
      ? 403
      : [
            "VERSION_CONFLICT",
            "REQUEST_CONFLICT",
            "INVALID_TRANSITION",
            "TARGET_UNAVAILABLE",
            "OWNER_PROTECTED",
            "RECOVERY_REVIEW_REQUIRED",
          ].includes(error)
        ? 409
        : error === "INVALID_INPUT"
          ? 400
          : 503;
}
// Best effort metadata only. Telemetry must never break billing or include provider payloads.
export async function adminEvent(kind: string) {
  if (!adminEnabled()) return;
  try {
    await billingAdmin().rpc("v25_record_event", { p_kind: kind });
  } catch {}
}
