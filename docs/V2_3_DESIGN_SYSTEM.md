# V2.3 Creative Office

Brand: **みんつく**。Hero: **つくりたい人、集合。**。Subcopy: **ひとりのアイデアを、みんなの作品へ。**
作品だけじゃなく、作品が生まれるまでを楽しむ。

## Visual system

白・薄いグレーを基調に、青のCTA、濃い本文、border中心の整理。system Japanese sans、太い見出し。装飾画像・追加UIライブラリなし。
app/globals.cssにprimary/success/danger/muted/background/surface/border/text、radius、spacing、typographyを定義。既存MVPのtoken aliasも維持。
制作中は緑、公開済みは青、準備中は灰、終了は赤。状態は色だけでなく文字で表示。
primary #2456df / white、success #16734b / #eaf6ef、muted #5d6574 / #f7f8fa、danger #b42338 / #fff0f1は本文コントラスト4.5:1以上をunit検証。

## Navigation and layouts

Desktop: logo、ルーム、作品、マイページ、プロフィール、作成、認証。
Mobile: Home / Rooms / Create / Works / My Pageの5項目、safe-area、44px以上を基本とする。
Skip link、focus-visible、semantic headings、input labels、role=status/alert、reduced-motion対応。
Roomは制作ログを主、概要/メンバー/AIを補助。1024px以下は横sidebarを積まず切替。非表示のeditorはアンマウントせず入力を保持。
完成作品ドラフト: 7 blocks、上下移動、追加削除、レビュー同意、live preview、409時の保持。危険操作はnative dialogでcancelに初期focus、Escape。

## Shared components

Header/NavIcon、Catalog/RoomCard/StatusBadge/EmptyState、v2.module.cssのpanel/row/button等。
AI Creatorは青い補助panel、明示AI badge、summaryと履歴切替。人間のcomposerを別の主要領域にする。
Workは鑑賞を主にし「この作品ができるまで」を独立CTAにする。

## Safety and data

V2 catalogはcaller-scoped Supabase clientと既存RLS、明示column allowlistだけで読む。Service Roleは追加しない。
V2_ENABLED・正確なstaging URL・認証・アカウント有効性を確認。My Pageは本人IDでfilter。
一覧18件、DB取得19件のcontinuation、検索300ms debounce。制作ログ既存30件cursor、検索350ms debounce。
作品カードは既存公開snapshot、画像は既存signing/eligibilityを継続。署名URLを永続保存・ログ出力しない。画像lazy/async decode。
会員名の公開範囲を広げない。Creatorのメンバー管理は既存RPC projectionを利用。
退会、Core承認、添付、公開、AI stop、同時編集は既存DB/APIの権限と検証を維持。
実AI HTTP429は未解消。V2.3では実providerを再送しない。
