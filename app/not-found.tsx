import Link from "next/link";
export default function NotFound() {
  return (
    <div className="emptyState">
      <span className="eyebrow">404 / PAGE NOT FOUND</span>
      <h1>このページは見つかりませんでした</h1>
      <p>URLを確認するか、ルーム一覧から探してみてください。</p>
      <div className="actions">
        <Link href="/rooms" className="btnPrimary">
          ルームを探す
        </Link>
        <Link href="/" className="btnGhost">
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
