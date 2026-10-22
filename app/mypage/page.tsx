import Link from "next/link";
import { v2Enabled } from "@/lib/v2/server";
import MyPage from "@/app/components/v2/MyPage";
export const dynamic = "force-dynamic";
export default function Page() {
  return v2Enabled() ? (
    <MyPage />
  ) : (
    <section className="emptyState">
      <h1>マイページ</h1>
      <p>
        活動一覧は現在準備中です。プロフィールの編集とルームへの参加は引き続き利用できます。
      </p>
      <div className="actions">
        <Link className="btnPrimary" href="/profile">
          プロフィール・設定
        </Link>
        <Link className="btnGhost" href="/rooms">
          ルームを探す
        </Link>
      </div>
    </section>
  );
}
