import { v2Enabled } from "@/lib/v2/server";
import RoomsListClient from "./RoomsListClient";
import Link from "next/link";
import Catalog from "@/app/components/v2/Catalog";
export const dynamic = "force-dynamic";
export default function RoomsPage() {
  return (
    <>
      <header className="sectionHeader pageIntro">
        <div>
          <span className="eyebrow">FIND YOUR CREATIVE TEAM</span>
          <h1>ルームを探す</h1>
          <p>気になるアイデアに出会ったら、まずはひとこと参加してみよう。</p>
        </div>
        <Link className="btnPrimary" href="/rooms/create">
          ＋ ルームを作る
        </Link>
      </header>
      {v2Enabled() ? <Catalog /> : <RoomsListClient />}
      <p className="muted">
        完成した作品は{" "}
        <Link className="textLink" href="/works">
          作品一覧へ →
        </Link>
      </p>
    </>
  );
}
