import "server-only";
import { v2Enabled, v2Client } from "@/lib/v2/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { freeProductionRelease } from "@/lib/v2/environment";
export const adminEnabled = () =>
  v2Enabled() &&
  process.env.ADMIN_ENABLED === "true";
export const adminJson = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export function adminSameOrigin(req: Request) {
  try {
    const raw = req.headers.get("origin");
    const origin = new URL(raw || "");
    if (origin.origin !== raw || origin.host !== req.headers.get("host") ||
        req.headers.get("sec-fetch-site") === "cross-site") return false;
    if (!process.env.VERCEL)
      return origin.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origin.hostname) &&
        process.env.VERCEL_ENV !== "production";
    return origin.protocol === "https:" &&
      (origin.hostname === process.env.VERCEL_URL ||
        (freeProductionRelease() && origin.origin === "https://minnade-tsukuru.vercel.app"));
  } catch { return false; }
}
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
    await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } })
      .rpc("v25_record_event", { p_kind: kind });
  } catch {}
}
