import { supabase } from "@/lib/supabase/client";
export type Row = Record<string, unknown>;
export type AdminData = {
  role: "owner" | "moderator";
  section: string;
  items: Row[];
  detail: Row | null;
  offset: number;
  checkedAt: string;
};
export type AdminAction = {
  request: string;
  action: string;
  type: string;
  target: string;
  version: number;
  value: unknown;
  reason: string;
  note: string;
  confirm: true;
};
export async function adminFetch(
  query: URLSearchParams,
  signal?: AbortSignal,
  body?: AdminAction,
): Promise<AdminData> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw Error("LOGIN_REQUIRED");
  const response = await fetch("/api/admin?" + query, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    signal,
    headers: {
      Authorization: "Bearer " + session.access_token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "ADMIN_UNAVAILABLE");
  return data;
}
export const errors: Record<string, string> = {
  LOGIN_REQUIRED: "ログインが必要です。",
  ADMIN_FORBIDDEN: "運営権限がありません。",
  OWNER_REQUIRED: "Ownerのみ利用できます。",
  RECENT_LOGIN_REQUIRED:
    "安全のため、一度ログアウトして再ログインしてください。",
  ADMIN_RATE_LIMITED: "操作が多すぎます。1分ほど待って再試行してください。",
  VERSION_CONFLICT:
    "他の操作で状態が変わりました。再読込して確認してください。",
  REQUEST_CONFLICT: "操作内容が一致しません。再読込してください。",
  INVALID_TRANSITION: "この状態では処理できません。再読込してください。",
  TARGET_UNAVAILABLE: "対象は操作できない状態です。",
  FEATURE_STOPPED: "この操作は停止中です。",
  RECOVERY_REVIEW_REQUIRED:
    "途中の外部処理が未確認です。復旧手順に沿って確認してください。",
  INVALID_INPUT:
    "入力内容を確認してください。メモには個人情報・秘密情報を書かないでください。",
  ADMIN_UNAVAILABLE:
    "運営情報を取得できません。時間をおいて再試行してください。",
};
