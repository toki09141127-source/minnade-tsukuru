"use client";
import type { AiPreferences, Plan } from "@/lib/billing/domain";
import s from "./Billing.module.css";
const presets: Record<string, Record<string, string>> = {
  icon: {
    spark: "きらめき",
    leaf: "葉っぱ",
    pen: "ペン",
    star: "星",
    compass: "コンパス",
    book: "本",
  },
  personality: {
    balanced: "バランス型",
    idea: "アイデア型",
    editor: "編集者型",
    facilitator: "進行役型",
    listener: "聞き役型",
    logical: "論理型",
  },
  style: { friendly: "親しみやすい", polite: "丁寧", concise: "簡潔" },
  activity: { low: "控えめ", medium: "標準", high: "活発" },
  inactivity: {
    "6": "6時間",
    "12": "12時間",
    "24": "24時間",
    off: "声掛けなし",
  },
};
const specialty = {
  story: "物語",
  characters: "キャラクター",
  world: "世界観",
  editing: "編集",
  planning: "進行",
  visual: "ビジュアル",
  music: "音楽",
};
export default function AiSettingsForm({
  value,
  onChange,
  plan,
  disabled = false,
}: {
  value: AiPreferences;
  onChange: (v: AiPreferences) => void;
  plan: Plan;
  disabled?: boolean;
}) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v }),
    select = (
      key: keyof AiPreferences,
      label: string,
      options = presets[key] ?? { low: "控えめ", medium: "標準", high: "多め" },
    ) => (
      <label key={key}>
        {label}
        <select
          aria-label={label}
          value={String(
            value[key] ??
              (key === "activity" ? "high" : Object.keys(options)[0]),
          )}
          onChange={(e) => set(key, e.target.value)}
        >
          {Object.entries(options).map(([v, l]) => (
            <option value={v} key={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <div className={s.form}>
      <fieldset disabled={disabled || plan === "free"}>
        <legend>名前と個性</legend>
        <div className={s.grid}>
          <label>
            AIの名前
            <input
              maxLength={40}
              value={value.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          {select("icon", "アイコン")}
          {select("personality", "個性")}
          {select("style", "話し方")}
          {select("activity", "活動頻度")}
        </div>
        <fieldset>
          <legend>専門分野（{plan === "pro" ? "5つまで" : "1つ"}）</legend>
          <div className={s.checks}>
            {Object.entries(specialty).map(([v, l]) => (
              <label key={v}>
                <input
                  type="checkbox"
                  checked={value.specialties?.includes(v) ?? false}
                  onChange={(e) => {
                    const current = value.specialties ?? [];
                    set(
                      "specialties",
                      e.target.checked
                        ? plan === "pro"
                          ? [...current, v].slice(0, 5)
                          : [v]
                        : current.filter((x) => x !== v),
                    );
                  }}
                />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>
      <fieldset disabled={disabled || plan !== "pro"}>
        <legend>Proの詳細設定</legend>
        {plan !== "pro" && (
          <p className={s.muted}>
            Proで編集できます。保存した設定は保持されます。
          </p>
        )}
        <label>
          プロフィール
          <textarea
            aria-label="プロフィール"
            maxLength={300}
            rows={3}
            value={value.profile ?? ""}
            onChange={(e) => set("profile", e.target.value)}
          />
        </label>
        {[
          "落ち着き ↔ 活発さ",
          "慎重 ↔ 大胆",
          "論理 ↔ 創造",
          "客観 ↔ 共感",
          "控えめ ↔ 積極的",
        ].map((label, i) => (
          <label key={label}>
            {label}（{value.sliders?.[i] ?? 2} / 4）
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={value.sliders?.[i] ?? 2}
              onChange={(e) => {
                const a = [...(value.sliders ?? [2, 2, 2, 2, 2])];
                a[i] = Number(e.target.value);
                set("sliders", a);
              }}
            />
          </label>
        ))}
        <div className={s.grid}>
          {select("politeness", "丁寧さ")}
          {select("length", "回答の長さ")}
          {select("emoji", "絵文字")}
          {select("jargon", "専門用語")}
          {select("questions", "質問頻度")}
          {select("inactivity", "停滞時の声掛け")}
          {select("ideas", "アイデアへの介入")}
          {select("meeting", "会議要約の詳しさ")}
          {select("finalEdit", "最終編集の方針")}
        </div>
        <label>
          <span>
            <input
              type="checkbox"
              checked={value.deadline ?? true}
              onChange={(e) => set("deadline", e.target.checked)}
            />
            締切前の声掛けを有効にする
          </span>
        </label>
        <label>
          制作上の希望
          <textarea
            aria-label="制作上の希望"
            maxLength={500}
            rows={4}
            value={value.instructions ?? ""}
            onChange={(e) => set("instructions", e.target.value)}
          />
        </label>
        <small>
          500文字まで。個人情報や秘密情報は入力しないでください。安全ルール・ルームの公開方針・人間の権限は変更できません。
        </small>
      </fieldset>
    </div>
  );
}
