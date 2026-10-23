import { supabase } from "@/lib/supabase/client";
export async function billingRequest<T>(
  body?: unknown,
  query?: URLSearchParams,
): Promise<T> {
  const { data } = await supabase.auth.getSession(),
    headers: Record<string, string> = {};
  if (data.session)
    headers.Authorization = "Bearer " + data.session.access_token;
  if (body) headers["Content-Type"] = "application/json";
  const r = await fetch(
    "/api/billing" + (query ? "?" + query.toString() : ""),
    {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    },
  );
  const result = await r.json();
  if (!r.ok) throw Error(result.error ?? "課金設定を確認できませんでした。");
  return result as T;
}
