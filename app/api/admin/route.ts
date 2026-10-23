import { adminCaller, adminJson, adminStatus } from "@/lib/admin/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const auth = await adminCaller(req);
    if (auth.response) return auth.response;
    const u = new URL(req.url),
      q = u.searchParams;
    const filters: Record<string, string> = {};
    for (const key of ["status", "action", "type", "actor", "severity"]) {
      const v = q.get(key);
      if (v) filters[key] = v;
    }
    const target = q.get("target");
    if (target && !/^[0-9a-f-]{36}$/i.test(target))
      return adminJson({ error: "INVALID_INPUT" }, 400);
    const { data, error } = await auth.client!.rpc("v25_admin_read", {
      p_section: q.get("section") || "overview",
      p_query: q.get("query") || "",
      p_filters: filters,
      p_sort: q.get("sort") || "newest",
      p_offset: Number(q.get("offset") || 0),
      p_days: Number(q.get("days") || 7),
      p_target: target,
    });
    if (error) return adminJson({ error: "ADMIN_UNAVAILABLE" }, 503);
    if (
      data.detail &&
      ["overview", "system", "ai"].includes(q.get("section") || "overview")
    )
      data.detail.startup = {
        ai: process.env.AI_ENABLED === "true",
        deletion_intake: process.env.MVP_ACCOUNT_REQUESTS_ENABLED === "true",
        deletion_worker: process.env.MVP_ACCOUNT_FINALIZE_ENABLED === "true",
        forced_publish: process.env.MVP_DRAFTS_ENABLED === "true",
      };
    return adminJson(data, data.error ? adminStatus(data.error) : 200);
  } catch {
    return adminJson({ error: "ADMIN_UNAVAILABLE" }, 503);
  }
}
export async function POST(req: Request) {
  try {
    const auth = await adminCaller(req);
    if (auth.response) return auth.response;
    const rawOrigin = req.headers.get("origin");
    let sameOrigin = false;
    try {
      const origin = new URL(rawOrigin || "");
      sameOrigin =
        origin.origin === rawOrigin &&
        origin.host === req.headers.get("host") &&
        (process.env.VERCEL
          ? origin.protocol === "https:" &&
            origin.hostname === process.env.VERCEL_URL
          : origin.protocol === "http:" &&
            ["127.0.0.1", "localhost"].includes(origin.hostname));
    } catch {}
    if (!sameOrigin || req.headers.get("sec-fetch-site") === "cross-site")
      return adminJson({ error: "ORIGIN_REJECTED" }, 403);
    if (
      !req.headers.get("content-type")?.startsWith("application/json") ||
      Number(req.headers.get("content-length") || 0) > 8192
    )
      return adminJson({ error: "INVALID_INPUT" }, 400);
    const raw = await req.text();
    if (raw.length > 8192) return adminJson({ error: "INVALID_INPUT" }, 400);
    const b = JSON.parse(raw);
    if (
      b.confirm !== true ||
      typeof b.request !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(b.request) ||
      !Number.isSafeInteger(b.version) ||
      Object.keys(b).some(
        (k) =>
          ![
            "confirm",
            "request",
            "action",
            "type",
            "target",
            "version",
            "value",
            "reason",
            "note",
          ].includes(k),
      )
    )
      return adminJson({ error: "INVALID_INPUT" }, 400);
    const { data, error } = await auth.client!.rpc("v25_admin_action", {
      p_request: b.request,
      p_action: b.action,
      p_type: b.type,
      p_target: b.target,
      p_version: b.version,
      p_value: b.value,
      p_reason: b.reason,
      p_note: b.note,
    });
    if (error) return adminJson({ error: "ADMIN_UNAVAILABLE" }, 503);
    return adminJson(data, data.error ? adminStatus(data.error) : 200);
  } catch {
    return adminJson({ error: "INVALID_INPUT" }, 400);
  }
}
