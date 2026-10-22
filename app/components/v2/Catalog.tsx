"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { v2Request } from "@/lib/v2/client";
import { GENRES, type Genre } from "@/lib/v2/domain";
import Attachment from "./Attachment";
export type CardRoom = {
  id: string;
  title: string;
  concept: string;
  genre: Genre;
  capacity: number;
  status: string;
  expires_at: string;
  created_at: string;
  ai_level: string;
  like_count: number;
  member_count: number;
  myRole: string | null;
  published_at: string | null;
  coverPostId: string | null;
};
export const aiLabels: Record<string, string> = {
  forbidden: "AI禁止",
  assist: "AI補助可",
  free: "AI自由",
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={
        "status " +
        (status === "forced_publish"
          ? "statusPublished"
          : status === "open"
            ? ""
            : status === "preparing"
              ? "statusPreparing"
              : "statusStopped")
      }
    >
      {status === "forced_publish"
        ? "公開済み"
        : status === "open"
          ? "制作中"
          : status === "preparing"
            ? "準備中"
            : "終了"}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  join = false,
}: {
  title: string;
  description: string;
  join?: boolean;
}) {
  return (
    <div className="emptyState">
      <h3>{title}</h3>
      <p>{description}</p>
      {join && (
        <div className="actions">
          <Link className="btnPrimary" href="/rooms">
            ルームを探す
          </Link>
          <Link className="btnGhost" href="/rooms/create">
            ルームを作る
          </Link>
        </div>
      )}
    </div>
  );
}
export function RoomCard({
  room: r,
  work = false,
}: {
  room: CardRoom;
  work?: boolean;
}) {
  return (
    <article className="catalogCard">
      {work && (
        <div className="cover">
          {r.coverPostId ? (
            <Attachment postId={r.coverPostId} mime="image/png" publicView />
          ) : (
            <>
              <span className="coverType" aria-hidden="true">
                {GENRES[r.genre]?.slice(0, 2) ?? "作品"}
              </span>
              <span className="coverLabel">MINTSUKU / ORIGINAL WORK</span>
            </>
          )}
        </div>
      )}
      <div className="cardContent">
        <div className="actions">
          <StatusBadge status={r.status} />
          <span className="genreText">{GENRES[r.genre]}</span>
        </div>
        <h3>
          <Link href={(work ? "/works/" : "/rooms/") + r.id}>{r.title}</Link>
        </h3>
        <p className="cardDescription">{r.concept}</p>
        {!work && (
          <div className="cardMeta">
            <span>
              {r.member_count} / {r.capacity}人
            </span>
            <span>{aiLabels[r.ai_level]}</span>
          </div>
        )}
        <div className="cardBottom">
          {work ? (
            <>
              <time dateTime={r.published_at ?? r.expires_at}>
                {new Date(r.published_at ?? r.expires_at).toLocaleDateString(
                  "ja-JP",
                )}{" "}
                公開
              </time>
              <span>♡ {r.like_count ?? 0}</span>
            </>
          ) : (
            <>
              <time dateTime={r.expires_at}>
                {new Date(r.expires_at).toLocaleDateString("ja-JP")} 締切
              </time>
              <span>
                {r.myRole
                  ? "参加中"
                  : r.member_count >= r.capacity
                    ? "定員に達しました"
                    : "ルームを見る →"}
              </span>
            </>
          )}
        </div>
        {!work && r.member_count >= r.capacity && (
          <p className="genreText">定員に達しました。完成をお楽しみに。</p>
        )}
      </div>
    </article>
  );
}
export default function Catalog({
  mode = "rooms",
  compact = false,
  mine = false,
}: {
  mode?: "rooms" | "works";
  compact?: boolean;
  mine?: boolean;
}) {
  const [rows, setRows] = useState<CardRoom[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [input, setInput] = useState(""),
    [q, setQ] = useState(""),
    [genre, setGenre] = useState(""),
    [ai, setAi] = useState(""),
    [sort, setSort] = useState("new"),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(input);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setRows([]);
        setRefresh((n) => n + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      void v2Request(
        "catalog",
        undefined,
        new URLSearchParams({
          mode,
          mine: String(mine),
          q,
          genre,
          ai,
          sort,
          page: String(page),
        }),
      )
        .then((r) => {
          if (live) {
            setRows(r.rooms);
            setMore(r.hasMore);
          }
        })
        .catch((e) => {
          if (live) {
            setRows([]);
            setError(e.message);
          }
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [mode, mine, q, genre, ai, sort, page, refresh]);
  const select = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(0);
  };
  return (
    <div>
      {!compact && (
        <div className="filterBar">
          <label className="searchField">
            キーワード
            <input
              type="search"
              placeholder="作りたいもの、気になるタイトル"
              value={input}
              maxLength={100}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <label>
            ジャンル
            <select
              aria-label="ジャンル"
              value={genre}
              onChange={(e) => select(setGenre, e.target.value)}
            >
              <option value="">すべて</option>
              {Object.entries(GENRES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {mode === "rooms" && (
            <label>
              AI Creator
              <select
                aria-label="AI Creator"
                value={ai}
                onChange={(e) => select(setAi, e.target.value)}
              >
                <option value="">すべて</option>
                {Object.entries(aiLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            並び順
            <select
              aria-label="並び順"
              value={sort}
              onChange={(e) => select(setSort, e.target.value)}
            >
              <option value="new">新着</option>
              {mode === "rooms" ? (
                <>
                  <option value="recommended">おすすめ</option>
                  <option value="deadline">締切間近</option>
                </>
              ) : (
                <option value="popular">人気</option>
              )}
            </select>
          </label>
        </div>
      )}
      {loading ? (
        <div role="status" aria-label="読み込み中" className="catalogGrid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton" />
          ))}
          <span>読み込んでいます…</span>
        </div>
      ) : error ? (
        <div role="alert" className="emptyState">
          <p>{error}</p>
          <button onClick={() => setRefresh((n) => n + 1)}>再試行</button>
        </div>
      ) : rows.length ? (
        <>
          <div className="catalogGrid">
            {(compact ? rows.slice(0, 3) : rows).map((r) => (
              <RoomCard key={r.id} room={r} work={mode === "works"} />
            ))}
          </div>
          {!compact && (page > 0 || more) && (
            <nav className="actions section" aria-label="一覧のページ">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                前のページ
              </button>
              <span aria-live="polite">{page + 1}ページ</span>
              <button disabled={!more} onClick={() => setPage((p) => p + 1)}>
                次のページ
              </button>
            </nav>
          )}
        </>
      ) : (
        <EmptyState
          title={
            mine
              ? "まず1つ、参加してみる"
              : mode === "rooms"
                ? "新しい制作が始まるのを待っています"
                : "最初の完成を、お楽しみに。"
          }
          description={
            q || genre || ai
              ? "検索条件を変えて探してみてください。"
              : "小さなアイデアから、一緒につくる仲間を探してみましょう。"
          }
          join={!q && !genre && !ai}
        />
      )}
    </div>
  );
}
export function Onboarding() {
  const [logged, setLogged] = useState(false);
  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (live) setLogged(!!data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setLogged(!!s));
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return logged ? (
    <aside className="onboarding">
      <div>
        <h2>まず1つ、参加してみる</h2>
        <p>アイデアひとつ、感想ひとことから。あなたも制作チームの一員に。</p>
      </div>
      <Link href="/rooms" className="textLink">
        仲間を探す →
      </Link>
    </aside>
  ) : null;
}
