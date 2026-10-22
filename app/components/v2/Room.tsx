"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { v2Request } from "@/lib/v2/client";
import {
  CONSENT_TEXT,
  CONSENT_VERSION,
  GENRES,
  type Role,
  type Genre,
  type Block,
} from "@/lib/v2/domain";
import LikeButton from "@/app/rooms/[id]/LikeButton";
import MarkRoomSeenOnView from "@/app/components/MarkRoomSeenOnView";
import DeleteRoomButton from "@/app/rooms/[id]/DeleteRoomButton";
import ReportButton from "@/app/rooms/[id]/ReportButton";
import DraftEditor from "./DraftEditor";
import AiCreator from "./AiCreator";
import Log from "./Log";
import { StatusBadge, aiLabels } from "./Catalog";
import styles from "./v2.module.css";
type Member = { user_id: string; name: string; role: Role };
type Pending = { id: string; user_id: string; name: string };
type State = {
  room: {
    id: string;
    title: string;
    description: string;
    genre: Genre;
    capacity: number;
    deadline: string;
    status: string;
    aiLevel: string;
  };
  myRole: Role | null;
  myUserId: string | null;
  memberCount: number;
  coreCount: number;
  kicked: boolean;
  rejections: number;
  pendingCore: boolean;
  members: Member[];
  requests: Pending[];
  resignations: Pending[];
  draft: { blocks: Block[]; version: number } | null;
  events: { id: number; kind: string; created_at: string }[];
};
const eventLabels: Record<string, string> = {
  created: "ルームが作成されました",
  core_approved: "Core申請が承認されました",
  core_rejected: "Core申請が審査されました",
  core_resigned: "Core辞退が承認されました",
  member_left: "Memberが退出しました",
  member_kicked: "参加状態が変更されました",
  core_demoted: "CoreがMemberへ変更されました",
  published: "作品が公開されました",
};
export default function Room({ roomId }: { roomId: string }) {
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [revision, setRevision] = useState(0),
    [pending, setPending] = useState<{
      action: string;
      target?: string;
      requestId?: string;
      label: string;
    } | null>(null),
    [clock, setClock] = useState<number | null>(null);
  const [panel, setPanel] = useState("production"),
    [workspace, setWorkspace] = useState("log");
  const dialog = useRef<HTMLDialogElement>(null),
    generation = useRef(0),
    authActor = useRef<string | null | undefined>(undefined);
  const load = useCallback(async () => {
    const g = ++generation.current;
    try {
      const s = await v2Request(
        "state",
        undefined,
        new URLSearchParams({ roomId }),
      );
      if (g === generation.current) setState(s);
    } catch (e) {
      if (g === generation.current)
        setError(e instanceof Error ? e.message : "読み込めませんでした。");
    }
  }, [roomId]);
  // Request generation prevents stale authentication responses from repopulating the view.
  useEffect(() => {
    void load();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const actor = session?.user.id ?? null;
      if (authActor.current === actor) return;
      authActor.current = actor;
      setState(null);
      setConsent(false);
      setTimeout(() => void load(), 0);
    });
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidates a request epoch, not a DOM ref.
      generation.current++;
      data.subscription.unsubscribe();
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    if (pending) dialog.current?.showModal();
    else dialog.current?.close();
  }, [pending]);
  async function action(action: string, target?: string, requestId?: string) {
    setBusy(true);
    setError("");
    try {
      await v2Request("member", {
        roomId,
        action,
        target,
        requestId,
        consent: consent ? CONSENT_VERSION : null,
      });
      setPending(null);
      await load();
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  if (!state)
    return (
      <div className={styles.shell}>
        <p role={error ? "alert" : "status"}>
          {error || "ルームを読み込んでいます…"}
        </p>
        {error && (
          <Link className="textLink" href="/rooms">
            ルーム一覧へ戻る →
          </Link>
        )}
      </div>
    );
  const { room } = state,
    open =
      room.status === "open" &&
      (clock === null || new Date(room.deadline).getTime() > clock),
    manager = state.myRole === "creator" || state.myRole === "core";
  return (
    <div className={styles.shell}>
      <MarkRoomSeenOnView roomId={roomId} />
      <Link className="textLink" href="/rooms">
        ← ルームを探す
      </Link>
      <header className={styles.roomHeader}>
        <div className={styles.row}>
          <StatusBadge status={room.status} />
          <span className="genreText">{GENRES[room.genre]}</span>
        </div>
        <h1>{room.title}</h1>
        <p>
          {GENRES[room.genre]} · {state.memberCount}/{room.capacity}人 · Core{" "}
          {state.coreCount}/4人
        </p>
        <p className={styles.roomMeta}>
          締切:{" "}
          <time dateTime={room.deadline}>
            {new Date(room.deadline).toLocaleString("ja-JP")}
          </time>{" "}
          · {aiLabels[room.aiLevel]}
        </p>
        {open && clock !== null && (
          <p className={styles.countdown}>
            残り{" "}
            {Math.floor(
              Math.max(0, new Date(room.deadline).getTime() - clock) / 86400000,
            )}
            日{" "}
            {Math.floor(
              Math.max(0, new Date(room.deadline).getTime() - clock) / 3600000,
            ) % 24}
            時間
          </p>
        )}
        <div className={styles.row}>
          {state.myRole && (
            <span className={styles.badge}>
              {state.myRole === "member"
                ? "Member"
                : state.myRole === "core"
                  ? "Core"
                  : "Creator"}
            </span>
          )}
          <LikeButton roomId={roomId} />
          <ReportButton targetType="room" targetId={roomId} />
          {state.myRole === "creator" && open && (
            <DeleteRoomButton roomId={roomId} />
          )}
        </div>
        {room.status === "forced_publish" ? (
          <Link className={styles.cta} href={"/works/" + roomId}>
            公開作品を見る
          </Link>
        ) : (
          !open && (
            <p role="status">
              締切を迎えました。作品の公開処理を待っています。
            </p>
          )
        )}
        {!state.myRole && (
          <div>
            {" "}
            {open && (
              <section className={styles.panel}>
                <h2>チームに参加する</h2>
                {!state.myUserId ? (
                  <Link href="/login">ログインして参加</Link>
                ) : (
                  <>
                    {!state.myRole && state.kicked ? (
                      <p>このルームには再参加できません。</p>
                    ) : !state.myRole && state.memberCount >= room.capacity ? (
                      <p>定員に達しました。完成をお楽しみに。</p>
                    ) : (
                      (!state.myRole || state.myRole === "member") && (
                        <label>
                          <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                          />
                          {CONSENT_TEXT} 同意します。
                        </label>
                      )
                    )}
                    {!state.myRole && !state.kicked && (
                      <button
                        disabled={
                          busy || !consent || state.memberCount >= room.capacity
                        }
                        onClick={() => action("join")}
                      >
                        Memberとして参加
                      </button>
                    )}
                    {state.myRole === "member" && (
                      <div className={styles.row}>
                        <button
                          disabled={
                            busy ||
                            !consent ||
                            state.pendingCore ||
                            state.rejections >= 3
                          }
                          onClick={() => action("apply_core")}
                        >
                          {state.pendingCore
                            ? "Core申請は審査待ち"
                            : "Coreに応募する"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            setPending({
                              action: "leave",
                              label: "退出しますか？ 過去の投稿は残ります。",
                            })
                          }
                        >
                          退出する
                        </button>
                        <span>残り申請回数: {3 - state.rejections}回</span>
                      </div>
                    )}
                    {state.myRole === "core" && (
                      <>
                        <button
                          disabled={busy || state.resignations.length > 0}
                          onClick={() => action("resign_core")}
                        >
                          {state.resignations.length
                            ? "Core辞退は承認待ち"
                            : "Coreを辞退する"}
                        </button>
                        <p>
                          Creatorの承認でMemberに戻った後、退出できます。承認待ちの間も制作できます。
                        </p>
                      </>
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        )}
      </header>
      <p role="alert" className={styles.error}>
        {error}
      </p>
      <div className={styles.roomLayout}>
        <div className={styles.roomTabs} role="group" aria-label="ルームの表示">
          {[
            ["production", "制作"],
            ["overview", "概要"],
            ["members", "メンバー"],
            ["ai", "AIまとめ"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={id === "production" ? styles.mobileOnly : undefined}
              aria-pressed={panel === id}
              onClick={() => {
                setPanel(id);
                if (id === "members") void load();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className={styles.workspace}
          data-mobile-visible={panel === "production"}
        >
          <div className={styles.workspaceTools}>
            <div className={styles.row}>
              <button
                aria-pressed={workspace === "log"}
                onClick={() => setWorkspace("log")}
              >
                制作ログ
              </button>
              {state.myRole && open && (
                <button
                  aria-pressed={workspace === "draft"}
                  onClick={() => setWorkspace("draft")}
                >
                  完成作品ドラフト
                </button>
              )}
            </div>
            {manager && open && (
              <button onClick={() => setPanel("ai")}>AIに聞く ↗</button>
            )}
          </div>
          <div hidden={workspace !== "log"}>
            {" "}
            {state.myRole || room.status === "forced_publish" ? (
              <Log
                key={state.myUserId ?? "anon"}
                roomId={roomId}
                publicView={room.status === "forced_publish"}
                canManage={manager && open}
                canPost={!!state.myRole && open}
                myUserId={state.myUserId}
                roles={Object.fromEntries(
                  state.members.map((m) => [m.user_id, m.role]),
                )}
                refreshKey={revision}
              />
            ) : (
              <section className={styles.panel}>
                <h2>制作ログ</h2>
                <p>参加すると、チームの制作ログを読んで投稿できます。</p>
                <p className={styles.muted}>
                  完成後は、公開確認を通過した制作ログを作品ページから読めます。
                </p>
              </section>
            )}
          </div>
          <div hidden={workspace !== "draft"}>
            {" "}
            {state.myRole && open && (
              <DraftEditor
                key={"draft-" + state.myUserId}
                roomId={roomId}
                title={room.title}
                genre={room.genre}
                initial={state.draft}
                editable={manager}
              />
            )}
          </div>
        </div>
        <aside
          className={styles.sidebar}
          data-mobile-visible={panel !== "production"}
        >
          <div
            className={styles.sidePanel}
            data-visible={panel === "overview" || panel === "production"}
          >
            <section className={styles.panel}>
              <h2>このルームについて</h2>
              <p className={styles.body}>{room.description}</p>
              <p className={styles.muted}>
                定員・締切・AIの利用方針は作成時に決まります。期限になると作品を公開します。
              </p>
            </section>{" "}
            {!!state.events.length && (
              <section className={styles.panel}>
                <h2>制作の節目</h2>
                <ul>
                  {state.events.map((e) => (
                    <li key={e.id}>
                      {eventLabels[e.kind] ?? "制作の状態が更新されました"} ·{" "}
                      <time>
                        {new Date(e.created_at).toLocaleString("ja-JP")}
                      </time>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <div className={styles.sidePanel} data-visible={panel === "members"}>
            <section className={styles.panel}>
              <h2>制作チーム</h2>
              <p>
                {state.memberCount}人 / Core {state.coreCount}人（最大4人）
              </p>
              {state.members.length ? (
                <ul className={styles.memberList}>
                  {[...state.members]
                    .sort(
                      (a, b) =>
                        ({ creator: 0, core: 1, member: 2 })[a.role] -
                        { creator: 0, core: 1, member: 2 }[b.role],
                    )
                    .map((m) => (
                      <li key={m.user_id}>
                        <span className={styles.avatar} aria-hidden="true">
                          {m.name.slice(0, 1)}
                        </span>
                        <div>
                          <strong>{m.name}</strong>
                          <br />
                          <span className={styles.badge}>
                            {m.role === "creator"
                              ? "Creator"
                              : m.role === "core"
                                ? "Core"
                                : "Member"}
                          </span>
                        </div>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className={styles.muted}>
                  参加者の管理はCreatorが行います。制作中の投稿は参加後に読めます。
                </p>
              )}
            </section>{" "}
            {open && (
              <section className={styles.panel}>
                <h2>チームに参加する</h2>
                {!state.myUserId ? (
                  <Link href="/login">ログインして参加</Link>
                ) : (
                  <>
                    {!state.myRole && state.kicked ? (
                      <p>このルームには再参加できません。</p>
                    ) : !state.myRole && state.memberCount >= room.capacity ? (
                      <p>定員に達しました。完成をお楽しみに。</p>
                    ) : (
                      (!state.myRole || state.myRole === "member") && (
                        <label>
                          <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                          />
                          {CONSENT_TEXT} 同意します。
                        </label>
                      )
                    )}
                    {!state.myRole && !state.kicked && (
                      <button
                        disabled={
                          busy || !consent || state.memberCount >= room.capacity
                        }
                        onClick={() => action("join")}
                      >
                        Memberとして参加
                      </button>
                    )}
                    {state.myRole === "member" && (
                      <div className={styles.row}>
                        <button
                          disabled={
                            busy ||
                            !consent ||
                            state.pendingCore ||
                            state.rejections >= 3
                          }
                          onClick={() => action("apply_core")}
                        >
                          {state.pendingCore
                            ? "Core申請は審査待ち"
                            : "Coreに応募する"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            setPending({
                              action: "leave",
                              label: "退出しますか？ 過去の投稿は残ります。",
                            })
                          }
                        >
                          退出する
                        </button>
                        <span>残り申請回数: {3 - state.rejections}回</span>
                      </div>
                    )}
                    {state.myRole === "core" && (
                      <>
                        <button
                          disabled={busy || state.resignations.length > 0}
                          onClick={() => action("resign_core")}
                        >
                          {state.resignations.length
                            ? "Core辞退は承認待ち"
                            : "Coreを辞退する"}
                        </button>
                        <p>
                          Creatorの承認でMemberに戻った後、退出できます。承認待ちの間も制作できます。
                        </p>
                      </>
                    )}
                  </>
                )}
              </section>
            )}
            {state.myRole === "creator" && open && (
              <section className={styles.panel}>
                <h2>参加者の管理</h2>
                <h3>Core申請</h3>
                {!state.requests.length && <p>処理待ちの申請はありません。</p>}
                {state.requests.map((r) => (
                  <div key={r.id} className={styles.block}>
                    <strong>{r.name}</strong>
                    <div className={styles.row}>
                      <button
                        disabled={busy}
                        onClick={() => action("approve_core", undefined, r.id)}
                      >
                        Coreへ承認
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          setPending({
                            action: "reject_core",
                            requestId: r.id,
                            label:
                              r.name +
                              "のCore申請を拒否しますか？ 申請回数を1回消費します。",
                          })
                        }
                      >
                        Core申請を拒否
                      </button>
                    </div>
                  </div>
                ))}
                <h3>Core辞退申請</h3>
                {state.resignations.map((r) => (
                  <div key={r.id} className={styles.row}>
                    <span>{r.name}</span>
                    <button
                      disabled={busy}
                      onClick={() =>
                        action("approve_resignation", undefined, r.id)
                      }
                    >
                      辞退を承認
                    </button>
                  </div>
                ))}
                <h3>参加者</h3>
                {state.members
                  .filter((m) => m.role !== "creator")
                  .map((m) => (
                    <div key={m.user_id} className={styles.block}>
                      <strong>
                        {m.name} · {m.role === "member" ? "Member" : "Core"}
                      </strong>
                      <div className={styles.row}>
                        {m.role === "core" && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              setPending({
                                action: "demote",
                                target: m.user_id,
                                label: m.name + "をMemberへ変更しますか？",
                              })
                            }
                          >
                            Memberへ降格
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() =>
                            setPending({
                              action: "kick",
                              target: m.user_id,
                              label:
                                "このメンバーをルームから外しますか？ " +
                                m.name +
                                "は再参加できなくなります。過去の投稿は残ります。",
                            })
                          }
                        >
                          ルームから外す
                        </button>
                      </div>
                    </div>
                  ))}
              </section>
            )}
          </div>
          <div className={styles.sidePanel} data-visible={panel === "ai"}>
            {" "}
            {(state.myRole || room.status === "forced_publish") && (
              <AiCreator
                key={"ai-" + (state.myUserId ?? "anon")}
                roomId={roomId}
                editable={manager}
                open={open}
                mode={room.aiLevel}
                onAccepted={() => {
                  void load();
                  setRevision((n) => n + 1);
                }}
              />
            )}
            {!state.myRole && room.status !== "forced_publish" && (
              <section className={styles.panel}>
                <h2>AI Creator</h2>
                <p>参加すると、このルームのAIまとめを確認できます。</p>
              </section>
            )}
          </div>
        </aside>
      </div>{" "}
      <dialog
        ref={dialog}
        aria-labelledby="confirmation-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setPending(null);
        }}
      >
        <h2 id="confirmation-title">操作の確認</h2>
        <p>{pending?.label}</p>
        <div className={styles.row}>
          <button autoFocus disabled={busy} onClick={() => setPending(null)}>
            キャンセル
          </button>
          <button
            disabled={busy}
            onClick={() =>
              pending &&
              action(pending.action, pending.target, pending.requestId)
            }
          >
            確認して実行
          </button>
        </div>
      </dialog>
    </div>
  );
}
