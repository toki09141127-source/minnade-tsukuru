"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { billingRequest } from "@/lib/billing/client";
import {
  planNames,
  type BillingConfig,
  type BillingState,
  type Plan,
  type Cycle,
  type AiPreferences,
  type Profile,
} from "@/lib/billing/domain";
import AiSettingsForm from "./AiSettingsForm";
import s from "./Billing.module.css";
const date = (v: string | null) =>
  v ? new Date(v).toLocaleString("ja-JP", { dateStyle: "medium" }) : "—";
export default function Billing({
  initialPlan = "plus",
  initialCycle = "month",
  returned = false,
}: {
  initialPlan?: Plan;
  initialCycle?: Cycle;
  returned?: boolean;
}) {
  const [state, setState] = useState<BillingState | null>(null),
    [config, setConfig] = useState<BillingConfig | null>(null),
    [enabled, setEnabled] = useState(false),
    [plan, setPlan] = useState<Plan>(initialPlan),
    [cycle, setCycle] = useState<Cycle>(initialCycle),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(
      returned
        ? "決済先から戻りました。確認通知を受け取るまではプランは変わりません。少し待って状態を更新してください。"
        : "",
    ),
    [busy, setBusy] = useState(false),
    [profile, setProfile] = useState<Profile | null>(null),
    [settings, setSettings] = useState<AiPreferences>({}),
    [name, setName] = useState(""),
    [editing, setEditing] = useState(false);
  const intent = useRef<{ id: string; body: string } | null>(null);
  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        billingRequest<BillingState>(),
        billingRequest<{ config: BillingConfig; paymentsEnabled: boolean }>(
          undefined,
          new URLSearchParams({ action: "plans" }),
        ),
      ]);
      setState(a);
      setConfig(b.config);
      setEnabled(b.paymentsEnabled);
      return a;
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込めませんでした。");
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function operation(
    action: string,
    resume?: NonNullable<BillingState["pendingOperation"]>,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const selection = resume?.selection ?? {
        action,
        ...(["checkout", "change"].includes(action) ? { plan, cycle } : {}),
      },
      body = JSON.stringify(selection);
    if (resume) intent.current = { id: resume.id, body };
    if (!intent.current || intent.current.body !== body) {
      intent.current = { id: crypto.randomUUID(), body };
    }
    try {
      const r = await billingRequest<{ ok: boolean; url?: string }>({
        ...selection,
        requestId: intent.current.id,
      });
      if (r.url) {
        const u = new URL(r.url);
        if (
          u.protocol !== "https:" ||
          !["checkout.stripe.com", "billing.stripe.com"].includes(u.hostname)
        )
          throw Error("決済画面を確認できませんでした。");
        window.location.assign(u.href);
        return;
      }
      intent.current = null;
      setNotice("手続きを受け付けました。決済サービスの確認後に反映されます。");
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "手続きを確認できませんでした。",
      );
    } finally {
      const refreshed = await load();
      if (refreshed && !refreshed.pendingOperation) intent.current = null;
      setBusy(false);
    }
  }
  async function saveProfile() {
    setBusy(true);
    setError("");
    try {
      await billingRequest({
        action: "profile",
        id: profile?.id ?? crypto.randomUUID(),
        version: profile?.version ?? 0,
        name,
        settings,
      });
      setEditing(false);
      await load();
      setNotice("AIプロフィールを保存しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  async function removeProfile(p: Profile) {
    setBusy(true);
    setError("");
    try {
      await billingRequest({
        action: "delete_profile",
        id: p.id,
        version: p.version,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={s.shell}>
      <header className={s.intro}>
        <span className="eyebrow">YOUR AI CREATOR</span>
        <h1>プランとAI利用枠</h1>
        <p>人間の制作はそのままに。AI Creatorとのつくり方を、ここから。</p>
        <Link href="/pricing">プランを比較する →</Link>
      </header>
      <p className={s.notice}>
        staging / test mode 専用です。実際の請求は行いません。
      </p>
      <p role="alert" className={s.error}>
        {error}
      </p>
      <p role="status">{notice}</p>
      {!state ? (
        <div className={s.panel}>
          <p>
            {error
              ? "ログイン状態を確認して再読込してください。"
              : "利用状況を読み込んでいます…"}
          </p>
          <Link href="/login">ログイン</Link>
          <button onClick={() => void load()}>再読込</button>
        </div>
      ) : (
        <>
          <section className={s.panel}>
            <div className={s.row}>
              <div>
                <span className={s.label}>現在のプラン</span>
                <h2>{planNames[state.plan]}</h2>
              </div>
              <button disabled={busy} onClick={() => void load()}>
                状態を更新
              </button>
            </div>
            <p>
              {state.cycle === "year"
                ? "年払い"
                : state.cycle === "month"
                  ? "月払い"
                  : "無料プラン"}{" "}
              · 次回更新 {date(state.renewalAt)}
            </p>
            {state.cancelAtEnd && (
              <p className={s.notice}>
                解約予約済みです。契約期間終了まで現在のプランを利用できます。
              </p>
            )}
            {state.nextPlan && !state.cancelAtEnd && (
              <p>
                次の更新から {planNames[state.nextPlan]} /{" "}
                {state.nextCycle === "year" ? "年払い" : "月払い"}{" "}
                に変更予定です。
              </p>
            )}
            {state.status === "grace" && (
              <p className={s.notice}>
                支払い確認中です。猶予期限：{date(state.graceUntil)}
                。新しいクレジットの付与を停止しています。
              </p>
            )}
            {["past_due", "unpaid", "incomplete"].includes(state.status) &&
              state.plan === "free" && (
                <p className={s.notice}>
                  支払いを確認できないため無料プランで利用中です。「支払い方法・請求書」から状況を確認してください。人間の制作は続けられます。
                </p>
              )}
            <h3>AIクレジット</h3>
            <div className={s.row}>
              <span className={s.usage}>
                {state.credits.consumed} / {state.credits.granted}
              </span>
              <span>
                残り {state.credits.remaining} · 処理中 {state.credits.reserved}
              </span>
            </div>
            <progress
              aria-label="AIクレジット使用量"
              className={s.bar}
              max={Math.max(1, state.credits.granted)}
              value={state.credits.consumed + state.credits.reserved}
            />
            <p className={s.muted}>
              次の枠の更新：{date(state.credits.periodEnd)}
              。クレジットは利用回数ではありません。処理ごとに消費量が異なります。
            </p>
            {state.credits.remaining === 0 && (
              <p>
                今月のAI利用枠を使い切りました。人間の投稿・制作は続けられます。
              </p>
            )}
          </section>
          <section className={s.panel}>
            <h2>契約の管理</h2>
            {!enabled && (
              <p className={s.notice}>
                テスト決済の接続を準備中です。無料の制作・保存済み設定の確認は利用できます。
              </p>
            )}
            {state.pendingOperation && (
              <p className={s.notice}>
                前回の決済処理を確認中です。再読み込み後も同じ操作を再確認できます。
                <button
                  disabled={
                    busy || !enabled || !state.pendingOperation.selection
                  }
                  onClick={() =>
                    void operation(
                      state.pendingOperation!.selection!.action,
                      state.pendingOperation!,
                    )
                  }
                >
                  前回の手続きを再確認
                </button>
              </p>
            )}
            <fieldset disabled={busy || !enabled || !!state.pendingOperation}>
              <legend>プランを選択</legend>
              <div className={s.grid}>
                <label>
                  プラン
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as Plan)}
                  >
                    <option value="plus">Plus</option>
                    <option value="pro">Pro</option>
                  </select>
                </label>
                <label>
                  支払い周期
                  <select
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value as Cycle)}
                  >
                    <option value="month">月払い</option>
                    <option value="year">年払い</option>
                  </select>
                </label>
              </div>
              {config && (
                <p>
                  テスト料金：¥
                  {(cycle === "year"
                    ? config.plans[plan].yearly
                    : config.plans[plan].monthly
                  ).toLocaleString("ja-JP")}{" "}
                  / {cycle === "year" ? "年" : "月"}
                </p>
              )}
              <p>
                同じ支払い周期の上位プランは支払い確認後すぐに反映。ダウングレード・周期変更・解約は次の更新から反映します。
              </p>
              <div className={s.actions}>
                <button
                  onClick={() =>
                    void operation(
                      state.plan === "free" &&
                        ["free", "canceled"].includes(state.status)
                        ? "checkout"
                        : "change",
                    )
                  }
                  className={s.primary}
                >
                  テスト決済で手続きを確認
                </button>
                {state.cycle !== null &&
                  !["free", "canceled"].includes(state.status) && (
                    <>
                      <button onClick={() => void operation("portal")}>
                        支払い方法・請求書
                      </button>
                      <button
                        onClick={() =>
                          void operation(
                            state.cancelAtEnd ? "resume" : "cancel",
                          )
                        }
                      >
                        {state.cancelAtEnd
                          ? "解約予約を取り消す"
                          : "次回更新で解約"}
                      </button>
                      {state.nextPlan && !state.cancelAtEnd && (
                        <button onClick={() => void operation("resume")}>
                          プラン変更予約を取り消す
                        </button>
                      )}
                    </>
                  )}
              </div>
            </fieldset>
          </section>
          <section className={s.panel}>
            <div className={s.row}>
              <h2>保存したAIプロフィール</h2>
              <button
                disabled={
                  busy || state.plan !== "pro" || state.profiles.length >= 5
                }
                onClick={() => {
                  setProfile(null);
                  setName("");
                  setSettings({});
                  setEditing(true);
                }}
              >
                新しいプロフィール
              </button>
            </div>
            <p className={s.muted}>
              最大5件。新しいルームで再利用できます。プランを下げても保存した設定は残り、Proに戻すと編集・再利用できます。
            </p>
            {state.plan !== "pro" && <p>Proで編集・再利用できます。</p>}
            <ul className={s.profileList}>
              {state.profiles.map((p) => (
                <li key={p.id}>
                  <div className={s.row}>
                    <strong>{p.name}</strong>
                    <div className={s.actions}>
                      <button
                        onClick={() => {
                          setProfile(p);
                          setName(p.name);
                          setSettings(p.settings);
                          setEditing(true);
                        }}
                      >
                        {state.plan === "pro" ? "編集" : "設定を見る"}
                      </button>
                      <button
                        disabled={busy || state.plan !== "pro"}
                        onClick={() => void removeProfile(p)}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {!state.profiles.length && <p>プロフィールはまだありません。</p>}
            {editing && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveProfile();
                }}
                className={s.form}
              >
                <h3>{profile ? "プロフィールの設定" : "新しいプロフィール"}</h3>
                <label>
                  保存名
                  <input
                    maxLength={40}
                    required
                    value={name}
                    disabled={state.plan !== "pro" || busy}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <AiSettingsForm
                  value={settings}
                  onChange={setSettings}
                  plan={state.plan}
                  disabled={busy}
                />
                <div className={s.actions}>
                  <button
                    disabled={busy || state.plan !== "pro"}
                    className={s.primary}
                  >
                    保存する
                  </button>
                  <button type="button" onClick={() => setEditing(false)}>
                    閉じる
                  </button>
                </div>
              </form>
            )}
          </section>
        </>
      )}
    </div>
  );
}
