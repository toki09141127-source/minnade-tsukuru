# みんなで作ろう（仮） / Minnade Tsukuru

最大50人で同じルームに集まり、役割分担しながら共同創作できるWebサービスです。

## Live Demo
- App: https://minnade-tsukuru.vercel.app
- X: https://x.com/minnade_tsukuru

## Overview
「みんなで作ろう（仮）」は、クリエイター志望者が一人では難しい創作に、チームで挑戦できる場を作ることを目的としたWebサービスです。

作品ごとに制作ルームを立ち上げ、参加者が creator / core / supporter といった役割に分かれながら、制作ログを積み重ね、最終提出まで進めることができます。

## Features
- 制作ルーム作成
- creator / core / supporter の役割分担
- 制作ログ投稿
- 最終提出作品
- 未読管理
- 通報機能
- 公開プロフィール
- SNSリンク
- ランキング
- AIレベル表示
- カテゴリー分類

## Tech Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Postgres / Auth / Storage)
- Vercel

## Architecture
- Frontend: Next.js App Router
- Backend: Next.js API Routes
- Database: Supabase Postgres
- Auth: Supabase Auth
- Storage: Supabase Storage
- Hosting: Vercel

## Directory Structure
```text
app/
components/
lib/
public/
supabase/
docs/