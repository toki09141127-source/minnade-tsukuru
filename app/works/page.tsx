import { v2Enabled } from "@/lib/v2/server";
import WorksListClient from "./WorksListClient";
import Catalog from "@/app/components/v2/Catalog";
export const dynamic = "force-dynamic";
export default function WorksPage() {
  return (
    <>
      <header className="pageIntro">
        <span className="eyebrow">MADE TOGETHER</span>
        <h1>みんなで生まれた作品</h1>
        <p>
          ひとつひとつに、仲間との時間がある。作品も、制作の過程も楽しもう。
        </p>
      </header>
      {v2Enabled() ? <Catalog mode="works" /> : <WorksListClient />}
    </>
  );
}
