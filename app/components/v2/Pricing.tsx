"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { billingRequest } from "@/lib/billing/client";
import {
  planCopy,
  planNames,
  type BillingConfig,
  type Cycle,
  type Plan,
} from "@/lib/billing/domain";
import s from "./Billing.module.css";
export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>("month"),
    [config, setConfig] = useState<BillingConfig | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void billingRequest<{ config: BillingConfig }>(
      undefined,
      new URLSearchParams({ action: "plans" }),
    )
      .then((r) => {
        if (live) setConfig(r.config);
      })
      .catch(() => {
        if (live) setError("料金を読み込めませんでした。再読込してください。");
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className={s.shell}>
      <header className={s.intro}>
        <span className="eyebrow">MORE ROOM FOR YOUR IDEAS</span>
        <h1>つくる楽しさは、みんなに。</h1>
        <p>
          共同創作の基本は無料。AI
          Creatorとつくる時間を深めたいときに、あなたに合うプランを。
        </p>
        <p className={s.notice}>
          stagingのテスト料金です。実際の請求は行いません。価格・AIクレジット数は暫定です。
        </p>
      </header>
      <div className={s.toggle} role="group" aria-label="支払い周期">
        {(
          [
            ["month", "月払い"],
            ["year", "年払い"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            className={cycle === v ? s.selected : undefined}
            aria-pressed={cycle === v}
            onClick={() => setCycle(v)}
          >
            {label}
          </button>
        ))}
      </div>
      {!config && !error && <p role="status">プランを読み込んでいます…</p>}
      <p role="alert" className={s.error}>
        {error}
      </p>
      {config && (
        <>
          <div className={s.plans}>
            {(["free", "plus", "pro"] as Plan[]).map((plan) => {
              const p = config.plans[plan],
                annual = plan !== "free" && cycle === "year";
              return (
                <article
                  key={plan}
                  className={
                    s.card + " " + (plan === "plus" ? s.recommended : "")
                  }
                >
                  <span className={s.badge}>
                    {plan === "plus"
                      ? "もっと深く作りたい方へ"
                      : plan === "pro"
                        ? "AIを自分らしく"
                        : "共同創作のはじまりに"}
                  </span>
                  <h2>{planNames[plan]}</h2>
                  <p>{planCopy[plan]}</p>
                  <div className={s.price}>
                    ¥{(annual ? p.yearly : p.monthly).toLocaleString("ja-JP")}
                    <small> / {annual ? "年" : "月"}</small>
                  </div>
                  {annual ? (
                    <p className={s.muted}>
                      月払い12か月より ¥
                      {(p.monthly * 12 - p.yearly).toLocaleString("ja-JP")} お得
                    </p>
                  ) : (
                    <p className={s.muted}>
                      共同創作の基本機能をすべて利用できます。
                    </p>
                  )}
                  <ul>
                    <li>最大50人でルーム制作</li>
                    <li>
                      毎月 {p.credits.toLocaleString("ja-JP")} AIクレジット
                    </li>
                    <li>
                      {plan === "free"
                        ? "基本の相談・整理・ドラフト提案"
                        : "詳しい議事録・世界観・ドラフトの支援"}
                    </li>
                    <li>
                      {plan === "pro"
                        ? "詳細な個性・話し方・介入方針"
                        : plan === "plus"
                          ? "名前・個性・専門分野の設定"
                          : "自動の挨拶・最低限の整理はクレジット不要"}
                    </li>
                    {plan === "pro" && <li>AIプロフィールを5件保存・再利用</li>}
                  </ul>
                  <Link
                    className={s.primary}
                    href={
                      plan === "free"
                        ? "/rooms/create"
                        : "/billing?plan=" + plan + "&cycle=" + cycle
                    }
                  >
                    {plan === "free"
                      ? "無料でつくる"
                      : planNames[plan] + "の手続きを確認"}
                  </Link>
                </article>
              );
            })}
          </div>
          <section className={s.panel} aria-labelledby="compare-title">
            <h2 id="compare-title">プランを比べる</h2>
            <div className={s.comparison} role="table" aria-label="プラン比較">
              <div className={s.compareRow} role="row">
                {["機能", "Free", "Plus", "Pro"].map((x) => (
                  <span role="columnheader" key={x}>
                    {x}
                  </span>
                ))}
              </div>
              {[
                ["共同創作・公開・通報", "利用可", "利用可", "利用可"],
                ["基本のAI Creator", "利用可", "利用可", "利用可"],
                ["名前・個性の設定", "基本設定", "プリセット", "詳細設定"],
                ["専門分野", "基本設定", "1つ", "複数"],
                ["詳細な整理・ドラフト", "基本", "高度", "最終編集まで"],
                ["保存AIプロフィール", "—", "—", "5件"],
                ["詳細な話し方・介入", "—", "—", "利用可"],
              ].map((row) => (
                <div className={s.compareRow} role="row" key={row[0]}>
                  {row.map((x, i) => (
                    <span key={i} role="cell">
                      {x}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </section>
          <section className={s.intro}>
            <h2>AIクレジットについて</h2>
            <p>
              クレジットは利用回数ではありません。相談・整理・ドラフトなど、処理の内容に応じて消費します。Creatorの枠を同じCreatorの全ルームで共有し、Coreからの依頼もその枠を使います。
            </p>
            <p>
              年払いでもクレジットは毎月更新。枠がなくなっても、人間の投稿や制作は続けられます。自動の挨拶や最低限の整理は別の運営上限で動作します。
            </p>
            <p>
              解約・ダウングレード・支払い周期の変更は次の契約更新から。支払い失敗時は3日間の猶予期間があります。
            </p>
          </section>
        </>
      )}
    </div>
  );
}
