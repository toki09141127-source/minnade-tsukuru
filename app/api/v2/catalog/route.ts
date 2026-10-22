import { NextResponse } from "next/server";
import { v2Client, v2Enabled } from "@/lib/v2/server";
import { GENRES, type Block } from "@/lib/v2/domain";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
// Caller-scoped, column-allowlisted reads only. Never use Service Role for discovery.
export async function GET(req: Request) {
  if (!v2Enabled()) return reply({ error: "この機能は利用できません。" }, 503);
  try {
    const u = new URL(req.url),
      p = u.searchParams,
      c = v2Client(req),
      mode = p.get("mode") ?? "rooms",
      mine = p.get("mine") === "true",
      q = (p.get("q") ?? "").trim(),
      genre = p.get("genre") ?? "",
      ai = p.get("ai") ?? "",
      sort = p.get("sort") ?? "new",
      page = Number(p.get("page") ?? 0);
    if (
      !["rooms", "works", "activity"].includes(mode) ||
      q.length > 100 ||
      !Number.isInteger(page) ||
      page < 0 ||
      page > 500 ||
      (genre && !(genre in GENRES)) ||
      (ai && !["forbidden", "assist", "free"].includes(ai)) ||
      !["new", "deadline", "recommended", "popular"].includes(sort)
    )
      return reply({ error: "検索条件を確認してください。" }, 400);
    const user = req.headers.has("authorization")
      ? (await c.auth.getUser()).data.user
      : null;
    if (req.headers.has("authorization") && !user)
      return reply({ error: "ログインし直してください。" }, 401);
    if (user) {
      const active = await c.rpc("mvp_current_account_active");
      if (active.error || active.data !== true)
        return reply({ error: "現在このアカウントでは利用できません。" }, 403);
    }
    if ((mine || mode === "activity") && !user)
      return reply({ error: "ログインしてください。" }, 401);
    if (mode === "activity") {
      const r = await c
        .from("room_join_requests")
        .select("id,room_id,created_at,status")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (r.error) throw Error("READ_FAILED");
      const ids = [...new Set((r.data ?? []).map((x) => x.room_id))];
      const rooms = ids.length
        ? await c.from("rooms").select("id,title").in("id", ids)
        : { data: [], error: null };
      if (rooms.error) throw Error("READ_FAILED");
      return reply({
        requests: (r.data ?? [])
          .filter((x) => rooms.data?.some((a) => a.id === x.room_id))
          .map((x) => ({
            ...x,
            title: rooms.data?.find((a) => a.id === x.room_id)?.title,
          })),
        limit: 30,
      });
    }
    let myIds: string[] | null = null;
    if (mine) {
      let membership = c
        .from("room_members")
        .select("room_id")
        .eq("user_id", user!.id)
        .limit(1000);
      // Published contributions remain on My Page after voluntarily leaving a room.
      if (mode !== "works") membership = membership.is("left_at", null);
      const m = await membership;
      if (m.error) throw Error("READ_FAILED");
      myIds = (m.data ?? []).map((x) => x.room_id);
      if (!myIds.length) return reply({ rooms: [], hasMore: false });
    }
    let query = c
      .from("rooms")
      .select(
        "id,title,concept,genre,capacity,status,expires_at,created_at,ai_level,like_count",
      )
      .eq("v2_enabled", true)
      .eq("status", mode === "works" ? "forced_publish" : "open")
      .eq("is_hidden", false)
      .is("deleted_at", null);
    if (mode === "rooms")
      query = query.gt("expires_at", new Date().toISOString());
    if (myIds) query = query.in("id", myIds);
    if (q)
      query = query.ilike("title", "%" + q.replace(/[%_\\]/g, "\\$&") + "%");
    if (genre) query = query.eq("genre", genre);
    if (ai) query = query.eq("ai_level", ai);
    query =
      sort === "deadline"
        ? query.order("expires_at", { ascending: true })
        : sort === "popular" || sort === "recommended"
          ? query
              .order("like_count", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false })
          : query.order("created_at", { ascending: false });
    const r = await query.order("id").range(page * 18, page * 18 + 18);
    if (r.error) throw Error("READ_FAILED");
    const rows = (r.data ?? []).slice(0, 18),
      ids = rows.map((x) => x.id);
    if (!ids.length) return reply({ rooms: [], hasMore: false });
    const [counts, members, snapshots] = await Promise.all([
      c.from("mvp_room_list").select("id,member_count").in("id", ids),
      user
        ? c
            .from("room_members")
            .select("room_id,role")
            .eq("user_id", user.id)
            .is("left_at", null)
            .in("room_id", ids)
        : Promise.resolve({ data: [], error: null }),
      mode === "works"
        ? c
            .from("v2_work_snapshots")
            .select("room_id,title,description,blocks,published_at")
            .in("room_id", ids)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (counts.error || members.error || snapshots.error)
      throw Error("READ_FAILED");
    return reply({
      rooms: rows.map((r) => {
        const s = snapshots.data?.find((x) => x.room_id === r.id),
          blocks = (s?.blocks ?? []) as Block[];
        return {
          ...r,
          title: s?.title ?? r.title,
          concept: s?.description ?? r.concept,
          member_count:
            counts.data?.find((x) => x.id === r.id)?.member_count ?? 0,
          myRole: members.data?.find((x) => x.room_id === r.id)?.role ?? null,
          published_at: s?.published_at ?? null,
          coverPostId: blocks.find((x) => x.type === "image")?.postId ?? null,
        };
      }),
      hasMore: (r.data?.length ?? 0) > 18,
    });
  } catch {
    return reply(
      { error: "読み込めませんでした。通信状況を確認して再試行してください。" },
      503,
    );
  }
}
