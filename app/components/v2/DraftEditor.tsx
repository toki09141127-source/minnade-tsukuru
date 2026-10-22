"use client";
import { useState } from "react";
import {
  BLOCK_LABELS,
  template,
  type Block,
  type Genre,
} from "@/lib/v2/domain";
import { v2Request } from "@/lib/v2/client";
import ImagePicker from "./ImagePicker";
import styles from "./v2.module.css";
export default function DraftEditor({
  roomId,
  title,
  genre,
  initial,
  editable,
}: {
  roomId: string;
  title: string;
  genre: Genre;
  initial: { blocks: Block[]; version: number } | null;
  editable: boolean;
}) {
  const [blocks, setBlocks] = useState<Block[]>(
      initial?.blocks ?? template(genre, title),
    ),
    [version, setVersion] = useState(initial?.version ?? 0),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [kind, setKind] = useState<Block["type"]>("text"),
    [latest, setLatest] = useState<{ blocks: Block[]; version: number } | null>(
      null,
    );
  const change = (id: string, fields: Partial<Block>) => {
    setReviewed(false);
    setBlocks((all) => all.map((b) => (b.id === id ? { ...b, ...fields } : b)));
  };
  const move = (i: number, d: number) => {
    if (i + d < 0 || i + d >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setBlocks(next);
    setReviewed(false);
  };
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const r = await v2Request("draft", { roomId, version, blocks, reviewed });
      setVersion(r.data);
      setMessage("保存しました。");
      setLatest(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  async function inspectLatest() {
    try {
      const s = await v2Request(
        "state",
        undefined,
        new URLSearchParams({ roomId }),
      );
      setLatest(s.draft ?? { blocks: [], version: 0 });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "読み込めませんでした。");
    }
  }
  return (
    <section className={styles.panel} aria-labelledby="draft-title">
      <h2 id="draft-title">完成作品ドラフト</h2>
      <p>
        公開時に内容と順番を固定します。画像は制作ログで公開確認したものを選びます。
      </p>
      <div className={styles.draftLayout}>
        <div>
          <fieldset disabled={busy || !editable}>
            {blocks.map((b, i) => (
              <div key={b.id} className={styles.block}>
                <div className={styles.row}>
                  <strong>
                    {i + 1}. {BLOCK_LABELS[b.type]}
                  </strong>
                  <button
                    type="button"
                    aria-label={"ブロック" + (i + 1) + "を上へ"}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={"ブロック" + (i + 1) + "を下へ"}
                    disabled={i === blocks.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={"ブロック" + (i + 1) + "を削除"}
                    onClick={() => {
                      setBlocks((all) => all.filter((x) => x.id !== b.id));
                      setReviewed(false);
                    }}
                  >
                    削除
                  </button>
                </div>
                {["heading", "summary", "text"].includes(b.type) && (
                  <label>
                    {BLOCK_LABELS[b.type]}の内容
                    <textarea
                      aria-label={BLOCK_LABELS[b.type] + "の内容"}
                      value={b.text ?? ""}
                      rows={b.type === "text" ? 5 : 2}
                      maxLength={20000}
                      onChange={(e) => change(b.id, { text: e.target.value })}
                    />
                  </label>
                )}
                {b.type === "image" && (
                  <ImagePicker
                    roomId={roomId}
                    value={b.postId ?? ""}
                    onChange={(postId) => change(b.id, { postId })}
                  />
                )}
                {b.type === "list" && (
                  <label>
                    項目（1行に1つ）
                    <textarea
                      rows={4}
                      value={(b.items ?? []).join("\n")}
                      onChange={(e) =>
                        change(b.id, { items: e.target.value.split("\n") })
                      }
                    />
                  </label>
                )}
                {b.type === "link" && (
                  <>
                    <label>
                      リンクの説明
                      <input
                        maxLength={200}
                        value={b.label ?? ""}
                        onChange={(e) =>
                          change(b.id, { label: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      公開URL
                      <input
                        type="url"
                        value={b.url ?? ""}
                        onChange={(e) => change(b.id, { url: e.target.value })}
                      />
                    </label>
                    <p className={styles.muted}>
                      httpsの公開ページのみ。認証用URLやクエリ付きURLは使えません。
                    </p>
                  </>
                )}
              </div>
            ))}
            <div className={styles.row}>
              <label>
                追加するブロック
                <select
                  aria-label="追加するブロック"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Block["type"])}
                >
                  {Object.entries(BLOCK_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={blocks.length >= 50}
                onClick={() => {
                  setBlocks((all) => [
                    ...all,
                    {
                      id: crypto.randomUUID(),
                      type: kind,
                      ...(kind === "list"
                        ? { items: [] }
                        : ["heading", "summary", "text"].includes(kind)
                          ? { text: "" }
                          : {}),
                    },
                  ]);
                  setReviewed(false);
                }}
              >
                ブロックを追加
              </button>
            </div>
            <label>
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              個人情報・権利・公開する内容を確認しました
            </label>
            <button
              className={styles.primary}
              disabled={!reviewed || busy}
              onClick={save}
            >
              完成作品ドラフトを保存
            </button>
          </fieldset>
        </div>
        <aside
          className={styles.draftPreview}
          aria-label="編集中のドラフトプレビュー"
        >
          <h3>プレビュー</h3>
          <p className={styles.muted}>
            保存前の内容です。画像は公開確認後に表示されます。
          </p>
          {blocks.map((b) => (
            <div key={b.id}>
              {b.type === "heading" ? (
                <h4>{b.text || "見出し"}</h4>
              ) : b.type === "divider" ? (
                <hr />
              ) : b.type === "list" ? (
                <ul>
                  {b.items?.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              ) : b.type === "image" ? (
                <p>▧ 画像{b.postId ? "を選択済み" : "を選択してください"}</p>
              ) : b.type === "link" ? (
                <p>↗ {b.label || "リンク"}</p>
              ) : (
                <p className={styles.body}>{b.text}</p>
              )}
            </div>
          ))}
        </aside>
      </div>
      <p role="status">{message}</p>
      <button onClick={inspectLatest} disabled={busy}>
        サーバーの最新版を確認
      </button>
      {latest && (
        <div className={styles.block}>
          <p>
            最新版: {latest.version} / 編集中: {version}
            。編集内容は自動で置き換えません。
          </p>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {latest.blocks
              .map((b) => b.text ?? b.items?.join("、") ?? BLOCK_LABELS[b.type])
              .join("\n")}
          </pre>
          <button
            onClick={() => {
              setBlocks(latest.blocks);
              setVersion(latest.version);
              setLatest(null);
              setReviewed(false);
              setMessage("最新版を読み込みました。");
            }}
          >
            編集内容を破棄して最新版に置き換える
          </button>
        </div>
      )}
    </section>
  );
}
