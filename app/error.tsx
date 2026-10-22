"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="emptyState">
      <h1>ページを表示できませんでした</h1>
      <p role="alert">通信状況を確認して、もう一度お試しください。</p>
      <div className="actions">
        <button className="btnPrimary" onClick={reset}>
          もう一度読み込む
        </button>
        <Link href="/" className="btnGhost">
          ホームへ戻る
        </Link>
      </div>
    </div>
  );
}
