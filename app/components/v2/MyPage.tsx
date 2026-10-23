"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { v2Request } from "@/lib/v2/client";
import Catalog, { EmptyState } from "@/app/components/v2/Catalog";
const tabs = ["活動中", "公開済み", "申請・通知", "プロフィール・設定"];
const statuses: Record<string, string> = {
  pending: "Core申請は審査待ち",
  approved: "Core申請が承認されました",
  rejected: "Core申請が承認されませんでした",
  revoked: "申請は終了しました",
};
export default function MyPage() {
  const [tab, setTab] = useState(0),
    [user, setUser] = useState<string | null | undefined>(undefined),
    [requests, setRequests] = useState<
      {
        id: string;
        room_id: string;
        title: string;
        status: string;
        created_at: string;
      }[]
    >([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (live) setUser(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user.id ?? null);
      setRequests([]);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!user || tab !== 2) return;
    let live = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void v2Request(
        "catalog",
        undefined,
        new URLSearchParams({ mode: "activity" }),
      )
        .then((r) => {
          if (live) {
            setRequests(r.requests);
            setError("");
          }
        })
        .catch(() => {
          if (live) setError("申請状況を読み込めませんでした。");
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [user, tab]);
  return (
    <>
      <header className="pageIntro">
        <span className="eyebrow">YOUR CREATIVE SPACE</span>
        <h1>マイページ</h1>
        <p>つくる途中も、完成したあとも。あなたの制作をここから。</p>
        <div className="actions">
          <Link href="/billing" className="btnGhost">
            プランとAI利用枠
          </Link>
          <Link href="/pricing" className="btnGhost">
            プランを比較する
          </Link>
        </div>
      </header>
      {user === undefined ? (
        <p role="status">読み込んでいます…</p>
      ) : !user ? (
        <div className="emptyState">
          <h2>あなたの制作スペースへ</h2>
          <p>ログインすると、参加しているルームと申請状況を確認できます。</p>
          <Link className="btnPrimary" href="/login">
            ログイン
          </Link>
        </div>
      ) : (
        <>
          <div className="tabs" role="group" aria-label="マイページの表示">
            {tabs.map((t, i) => (
              <button
                key={t}
                aria-pressed={tab === i}
                onClick={() => setTab(i)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab < 2 ? (
            <Catalog key={tab} mine mode={tab === 1 ? "works" : "rooms"} />
          ) : tab === 2 ? (
            <section aria-label="申請・通知">
              <p className="muted">
                最近のCore申請を30件まで表示します。辞退申請は各ルームのメンバー画面、作品の公開は「公開済み」で確認できます。
              </p>
              {loading ? (
                <p role="status">申請を読み込んでいます…</p>
              ) : error ? (
                <p role="alert">{error}</p>
              ) : requests.length ? (
                <ul className="progressList">
                  {requests.map((r) => (
                    <li key={r.id}>
                      <span className="pill">
                        {statuses[r.status] ?? "申請の状態が更新されました"}
                      </span>
                      <h3>
                        <Link href={"/rooms/" + r.room_id}>{r.title}</Link>
                      </h3>
                      <time>
                        {new Date(r.created_at).toLocaleDateString("ja-JP")}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="申請のお知らせはまだありません"
                  description="参加中のルームでCoreに応募すると、ここに状況が表示されます。"
                />
              )}
            </section>
          ) : (
            <section className="emptyState">
              <h2>あなたらしく、制作に参加しよう。</h2>
              <p>
                ユーザー名・自己紹介・公開リンク、アカウントの設定を管理できます。
              </p>
              <Link className="btnPrimary" href="/profile">
                プロフィール・設定を開く
              </Link>
            </section>
          )}
        </>
      )}
    </>
  );
}
