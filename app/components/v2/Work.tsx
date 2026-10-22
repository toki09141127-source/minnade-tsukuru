"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { v2Request } from "@/lib/v2/client";
import { GENRES, type Genre, type Block } from "@/lib/v2/domain";
import LikeButton from "@/app/rooms/[id]/LikeButton";
import ReportButton from "@/app/rooms/[id]/ReportButton";
import type { AiOutput } from "@/lib/ai/safety";
import Attachment from "./Attachment";
import AiCreator from "./AiCreator";
import Log from "./Log";
import { StatusBadge } from "./Catalog";
import styles from "./v2.module.css";
type Snapshot = {
  title: string;
  description: string;
  genre: Genre;
  blocks: Block[];
  incomplete: boolean;
  published_at: string;
  aiLevel: string;
  contains_ai_assistance: boolean;
  aiAssistance: AiOutput | null;
};
export default function Work({
  roomId,
  logOnly = false,
}: {
  roomId: string;
  logOnly?: boolean;
}) {
  const [work, setWork] = useState<Snapshot | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void v2Request("work", undefined, new URLSearchParams({ roomId }))
      .then((w) => {
        if (live) setWork(w);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [roomId]);
  if (!work)
    return (
      <div className={styles.shell}>
        <p role="status">{error || "作品を読み込んでいます…"}</p>
      </div>
    );
  return (
    <div className={styles.shell + " " + styles.workShell}>
      <Link href={logOnly ? "/works/" + roomId : "/works"}>
        ← {logOnly ? "作品に戻る" : "完成作品一覧"}
      </Link>
      {work.contains_ai_assistance && (
        <p className={styles.badge}>
          AIの整理・提案を含む作品です。採用・制作は人間が行っています。
        </p>
      )}
      <header className={styles.workHero}>
        <StatusBadge status="forced_publish" />
        <h1>{work.title}</h1>
        <p>
          {GENRES[work.genre]} · {work.incomplete ? "未完成作品" : "公開作品"}
        </p>
        <p className={styles.body}>{work.description}</p>
        <p className={styles.muted}>
          公開日{" "}
          <time dateTime={work.published_at}>
            {new Date(work.published_at).toLocaleDateString("ja-JP")}
          </time>
        </p>
        <div className={styles.row}>
          <LikeButton roomId={roomId} />
          <ReportButton targetType="room" targetId={roomId} />
        </div>
      </header>
      {logOnly ? (
        <>
          <Log roomId={roomId} publicView />
          <AiCreator
            roomId={roomId}
            editable={false}
            open={false}
            mode={work.aiLevel}
            onAccepted={() => {}}
          />
        </>
      ) : (
        <>
          <p className={styles.muted}>
            公開時の内容を保存しています。
            {work.incomplete ? "未完成の部分をAIで補完していません。" : ""}
          </p>
          <div className={styles.workBody}>
            {work.blocks.map((b) => (
              <div key={b.id}>
                {b.type === "heading" ? (
                  <h2>{b.text}</h2>
                ) : b.type === "image" ? (
                  <Attachment postId={b.postId!} mime="image/png" publicView />
                ) : b.type === "list" ? (
                  <ul>
                    {b.items?.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : b.type === "divider" ? (
                  <hr />
                ) : b.type === "link" ? (
                  <a href={b.url} target="_blank" rel="noopener noreferrer">
                    {b.label || "映像・音源を開く"}
                  </a>
                ) : (
                  <p className={styles.body}>{b.text}</p>
                )}
              </div>
            ))}
          </div>{" "}
          {work.aiAssistance && (
            <section className={styles.panel}>
              <h2>AI Creatorによる制作の整理 · AI</h2>
              <p>
                期限到来時にAI
                Creatorが制作ログ・ハイライトを整理して生成した内容を含みます。
              </p>
              <p className={styles.body}>{work.aiAssistance.message}</p>
              <h3>未決事項・確認候補</h3>
              <ul>
                {work.aiAssistance.unresolved.map((v, i) => (
                  <li key={i}>{v.text}</li>
                ))}
              </ul>
            </section>
          )}
          <aside className={styles.workCta}>
            <h2>作品の、その前に。</h2>
            <p>アイデアが作品になるまで。チームの試行錯誤をたどってみよう。</p>
            <Link className={styles.cta} href={"/works/" + roomId + "/log"}>
              この作品ができるまで
            </Link>
          </aside>
        </>
      )}
    </div>
  );
}
