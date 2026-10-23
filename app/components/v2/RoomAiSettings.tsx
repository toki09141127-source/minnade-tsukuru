"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { billingRequest } from "@/lib/billing/client";
import {
  planNames,
  type AiPreferences,
  type RoomBilling,
} from "@/lib/billing/domain";
import AiSettingsForm from "./AiSettingsForm";
import s from "./Billing.module.css";
export default function RoomAiSettings({ roomId }: { roomId: string }) {
  const [state, setState] = useState<RoomBilling | null>(null),
    [value, setValue] = useState<AiPreferences>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await billingRequest<RoomBilling>(
        undefined,
        new URLSearchParams({ roomId }),
      );
      setState(r);
      setValue(r.settings);
    } catch {
      setError("AIプランの設定を確認できませんでした。");
    }
  }, [roomId]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function save() {
    if (!state) return;
    setBusy(true);
    setError("");
    setNotice("");
    const common = [
        "name",
        "icon",
        "personality",
        "style",
        "specialties",
        "activity",
      ],
      settings =
        state.ownerPlan === "pro"
          ? value
          : Object.fromEntries(
              Object.entries(value)
                .filter(([k]) => common.includes(k))
                .map(([k, v]) => [
                  k,
                  k === "specialties" ? (v as string[]).slice(0, 1) : v,
                ]),
            );
    try {
      await billingRequest({ action: "settings", roomId, settings });
      await load();
      setNotice("設定を保存しました。次のAI依頼から使われます。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={s.panel + " " + s.compact}
      aria-label="AI Creatorのプラン"
    >
      <p role="alert" className={s.error}>
        {error}
      </p>
      {state && (
        <>
          <div className={s.row}>
            <h3>
              {planNames[state.plan]} AI Creator
              {state.settings.name ? " · " + state.settings.name : ""}
            </h3>
            <span>Creatorの残り枠 {state.remaining}</span>
          </div>
          <p className={s.muted}>
            Coreの依頼もCreatorの利用枠を共有します。進行中ルームの機能は期限まで保持されます。
          </p>
          {state.isCreator ? (
            <details>
              <summary>AIの個性・設定</summary>
              {!state.canEdit && (
                <p>
                  有料設定は保持されています。
                  <Link href="/billing">Plus以上のプラン</Link>
                  で編集中のルームへ設定できます。
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <AiSettingsForm
                  value={value}
                  onChange={setValue}
                  plan={state.ownerPlan}
                  disabled={!state.canEdit || busy}
                />
                <button className={s.primary} disabled={!state.canEdit || busy}>
                  AI設定を保存
                </button>
              </form>
              <p role="status">{notice}</p>
            </details>
          ) : (
            <p className={s.muted}>AIの個性はCreatorが設定します。</p>
          )}
        </>
      )}
    </section>
  );
}
