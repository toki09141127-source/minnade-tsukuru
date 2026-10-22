import { v2Enabled } from "@/lib/v2/server";
import Link from "next/link";
import Catalog, { Onboarding } from "./components/v2/Catalog";
export const dynamic = "force-dynamic";
export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">MINTSUKU — CREATE TOGETHER</span>
          <h1>
            つくりたい人、
            <br />
            集合。
          </h1>
          <p className="heroLead">ひとりのアイデアを、みんなの作品へ。</p>
          <p className="heroCopy">
            小説も、イラストも、まだ名前のないアイデアも。
            <br />
            仲間と集まって、話して、つくって。
            <br />
            ここから、ひとつの作品をはじめよう。
          </p>
          <div className="actions">
            <Link href="/rooms" className="btnPrimary">
              制作中のルームを見る ↗
            </Link>
            <Link href="/rooms/create" className="btnGhost">
              ＋ ルームを作る
            </Link>
          </div>
        </div>
        <div className="heroBoard" aria-label="制作の流れ">
          <div className="boardTop">
            <span>OUR CREATIVE PROCESS</span>
            <span>みんつく</span>
          </div>
          {[
            ["01", "「つくりたい」を持ち寄る", "ルームで仲間と出会う"],
            ["02", "アイデアを重ねる", "制作ログに、試行錯誤を残す"],
            ["03", "ひとつの作品になる", "完成までの過程も、みんなの作品"],
          ].map(([n, title, copy]) => (
            <div className="boardLine" key={n}>
              <span className="boardNumber">{n}</span>
              <div>
                <strong>{title}</strong>
                <small>{copy}</small>
              </div>
            </div>
          ))}
          <div className="boardFooter">
            作品だけじゃなく、作品が生まれるまでを楽しむ。
          </div>
        </div>
      </section>
      <Onboarding />
      <section className="section">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">IN THE MAKING</span>
            <h2>いま、みんなが作っているもの</h2>
          </div>
          <Link className="textLink" href="/rooms">
            すべてのルーム →
          </Link>
        </div>
        {v2Enabled() ? (
          <Catalog compact />
        ) : (
          <Link className="textLink" href="/rooms">
            ルーム一覧から探す →
          </Link>
        )}
      </section>
      <section className="section">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">JUST COMPLETED</span>
            <h2>最近完成した作品</h2>
          </div>
          <Link className="textLink" href="/works">
            作品をもっと見る →
          </Link>
        </div>
        {v2Enabled() ? (
          <Catalog compact mode="works" />
        ) : (
          <Link className="textLink" href="/works">
            完成作品を見に行く →
          </Link>
        )}
      </section>
      <aside className="onboarding">
        <div>
          <h2>完成までの過程にも、おもしろさがある。</h2>
          <p>
            作品ページの「この作品ができるまで」から、制作チームの試行錯誤をのぞいてみよう。
          </p>
        </div>
        <Link href="/works" className="textLink">
          作品を見る →
        </Link>
      </aside>
    </>
  );
}
