"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
const links = [
  ["/", "ホーム", "home"],
  ["/rooms", "ルーム", "rooms"],
  ["/rooms/create", "つくる", "create"],
  ["/works", "作品", "works"],
  ["/mypage", "マイページ", "me"],
];
export function NavIcon({ kind }: { kind: string }) {
  const d: Record<string, string> = {
    home: "M3 10 12 3l9 7v10H5V10m4 10v-7h6v7",
    rooms: "M3 4h7v7H3zm11 0h7v7h-7zM3 15h7v6H3zm11 0h7v6h-7z",
    create: "M12 4v16M4 12h16",
    works: "M4 4h16v16H4zM4 15l5-5 5 5 3-3 3 3",
    me: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3",
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d[kind]} />
    </svg>
  );
}
export default function Header() {
  const router = useRouter(),
    pathname = usePathname(),
    [logged, setLogged] = useState(false);
  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (live) setLogged(!!data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setLogged(!!s));
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const active = (href: string) =>
    pathname === href ||
    (href === "/rooms" &&
      pathname.startsWith("/rooms/") &&
      pathname !== "/rooms/create") ||
    (href === "/works" && pathname.startsWith("/works/"));
  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setLogged(false);
      router.replace("/");
      router.refresh();
    }
  }
  return (
    <>
      <a href="#main-content" className="skipLink">
        本文へ移動
      </a>
      <header className="header">
        <div className="headerInner">
          <Link href="/" className="brand" aria-label="みんつく ホーム">
            <span className="brandMark" aria-hidden="true">
              m.
            </span>
            みんつく
          </Link>
          <nav className="nav" aria-label="メインナビゲーション">
            {[
              ["/rooms", "ルームを探す"],
              ["/works", "作品を見る"],
              ["/mypage", "マイページ"],
            ].map(([url, label]) => (
              <Link
                key={url}
                href={url}
                aria-current={active(url) ? "page" : undefined}
                className="navBtn desktopNav"
              >
                {label}
              </Link>
            ))}
            <Link href="/pricing" className="navBtn optionalNav desktopNav">
              プラン
            </Link>
            <Link href="/profile" className="navBtn optionalNav desktopNav">
              プロフィール
            </Link>
            <Link href="/rooms/create" className="navBtnPrimary desktopNav">
              ＋ ルームを作る
            </Link>
            {logged ? (
              <button className="navBtn" onClick={logout}>
                ログアウト
              </button>
            ) : (
              <Link href="/login" className="navBtn">
                ログイン →
              </Link>
            )}
          </nav>
        </div>
      </header>
      <nav className="mobileNav" aria-label="モバイルナビゲーション">
        {links.map(([url, label, icon]) => (
          <Link
            key={url}
            href={url}
            className={icon === "create" ? "createNav" : ""}
            aria-current={active(url) ? "page" : undefined}
          >
            <span>
              <NavIcon kind={icon} />
            </span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
