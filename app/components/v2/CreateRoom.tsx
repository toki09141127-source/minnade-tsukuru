"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CONSENT_TEXT, GENRES, type Genre } from "@/lib/v2/domain";
import { v2Request } from "@/lib/v2/client";
import styles from "./v2.module.css";
const subscribeReady = () => () => {};
export default function CreateRoom() {
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  const router = useRouter(),
    request = useRef<{ key: string; deadline: string; payload: string } | null>(
      null,
    );
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [genre, setGenre] = useState<Genre>("novel"),
    [capacity, setCapacity] = useState("10"),
    [customCapacity, setCustomCapacity] = useState(10),
    [hours, setHours] = useState("48"),
    [customDeadline, setCustomDeadline] = useState(""),
    [ai, setAi] = useState("forbidden"),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = JSON.stringify({
        title,
        description,
        genre,
        capacity,
        customCapacity,
        hours,
        customDeadline,
        ai,
      });
      if (request.current?.payload !== payload)
        request.current = {
          key: crypto.randomUUID(),
          deadline:
            hours === "custom"
              ? new Date(customDeadline).toISOString()
              : new Date(Date.now() + Number(hours) * 3600000).toISOString(),
          payload,
        };
      const result = await v2Request("create", {
        requestId: request.current.key,
        title,
        description,
        genre,
        capacity: capacity === "custom" ? customCapacity : Number(capacity),
        deadline: request.current.deadline,
        aiLevel: ai,
        consent,
      });
      router.push("/rooms/" + result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.shell + " " + styles.formShell}>
      <span className="eyebrow">START SOMETHING TOGETHER</span>
      <h1>ルームを作る</h1>
      <p>人間の仲間と、ひとつの作品をつくりましょう。</p>
      <form onSubmit={submit}>
        <fieldset disabled={!ready || busy}>
          <section className={styles.formSection}>
            <h2>
              <span className={styles.formNumber}>01</span>基本情報
            </h2>
            <label>
              タイトル
              <input
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              何をつくりたい？
              <textarea
                required
                minLength={20}
                maxLength={300}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <p className={styles.muted}>
              20〜300文字。個人情報は書かないでください。
            </p>
          </section>
          <section className={styles.formSection}>
            <h2>
              <span className={styles.formNumber}>02</span>ジャンル
            </h2>
            <label>
              ジャンル
              <select
                aria-label="ジャンル"
                value={genre}
                onChange={(e) => setGenre(e.target.value as Genre)}
              >
                {Object.entries(GENRES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className={styles.formSection}>
            <h2>
              <span className={styles.formNumber}>03</span>参加人数
            </h2>
            <label>
              定員
              <select
                aria-label="定員"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              >
                {[5, 10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}人
                  </option>
                ))}
                <option value="custom">人数を指定</option>
              </select>
            </label>
            {capacity === "custom" && (
              <label>
                定員の人数
                <input
                  type="number"
                  min={2}
                  max={50}
                  required
                  value={customCapacity}
                  onChange={(e) => setCustomCapacity(Number(e.target.value))}
                />
              </label>
            )}
          </section>
          <section className={styles.formSection}>
            <h2>
              <span className={styles.formNumber}>04</span>制作期間
            </h2>
            <label>
              制作期間
              <select
                aria-label="制作期間"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              >
                {[6, 24, 48, 72, 168, 336].map((n) => (
                  <option key={n} value={n}>
                    {n < 24 ? n + "時間" : n / 24 + "日"}
                  </option>
                ))}
                <option value="custom">締切を指定</option>
              </select>
            </label>
            {hours === "custom" && (
              <label>
                締切日時
                <input
                  type="datetime-local"
                  required
                  value={customDeadline}
                  onChange={(e) => setCustomDeadline(e.target.value)}
                />
              </label>
            )}
          </section>
          <section className={styles.formSection}>
            <h2>
              <span className={styles.formNumber}>05</span>AI Creator
            </h2>
            <p className={styles.muted}>
              チームのつくり方に合わせて選びましょう。
            </p>
            <div role="group" aria-label="AIの利用方針">
              {[
                ["forbidden", "AI禁止", "AI Creatorを使用しません。"],
                ["assist", "AI補助可", "必要なときに整理・相談を手伝います。"],
                ["free", "AI自由", "アイデアや進行もより積極的に支援します。"],
              ].map(([value, label, copy]) => (
                <label className={styles.aiOption} key={value}>
                  <input
                    type="radio"
                    name="aiLevel"
                    value={value}
                    checked={ai === value}
                    onChange={() => setAi(value)}
                  />
                  <span>
                    {label}
                    <small>{copy}</small>
                  </span>
                </label>
              ))}
            </div>{" "}
            {ai !== "forbidden" && (
              <p>
                AI
                Creatorは同じルームの文章を外部AI（OpenAI）へ送り、制作を整理・提案します。個人情報・秘密情報は入力しないでください。AIが人間の代わりに決定することはありません。
              </p>
            )}
          </section>
          <section className={styles.formSection}>
            <h2>作成前に確認</h2>
            <p className="notice">
              定員・締切・AIの利用方針は作成後に変更できません。締切は1時間以上先、最大2週間です。
            </p>
            <label>
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {CONSENT_TEXT} 同意して作成します。
            </label>
            <button className={styles.primary} disabled={busy || !consent}>
              {busy ? "作成中…" : "ルームを作る"}
            </button>
          </section>
        </fieldset>
        <p role="alert" className={styles.error}>
          {error}
        </p>
      </form>
    </div>
  );
}
