"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
export default function Attachment({
  postId,
  mime,
  publicView = false,
}: {
  postId: string;
  mime: string | null;
  publicView?: boolean;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession(),
          headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
        if (data.session)
          headers.Authorization = "Bearer " + data.session.access_token;
        const r = await fetch(
            publicView ? "/api/storage/sign" : "/api/uploads/sign",
            {
              method: "POST",
              headers,
              body: JSON.stringify({ postId }),
              signal: controller.signal,
            },
          ),
          j = await r.json();
        if (!r.ok) throw Error("この添付は表示できません。");
        if (live) setUrl(j.signedUrl);
      } catch {
        if (live) setError("この添付は表示できません。");
      }
    })();
    return () => {
      live = false;
      controller.abort();
    };
  }, [postId, publicView]);
  if (!url) return <p role="status">{error || "添付を確認中…"}</p>;
  return mime?.startsWith("image/") ? (
    <img src={url} alt="制作ログの添付画像" loading="lazy" decoding="async" />
  ) : (
    <a href={url} target="_blank" rel="noopener noreferrer">
      添付ファイルを開く
    </a>
  );
}
