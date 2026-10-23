# AI_TASK

## Status
done

## Objective
V2.5 運営管理画面・基盤を develop/v2 / staging / Hosted Previewで実装・検収する。

## Context
添付66dbe3b8の要件。開始b794e0e clean、実装79a15d7。承認済み6jtg2klwo Preview / staging fwqucffxdmbdczspkcyr限定。production操作なし。

## Tasks
1. done: Owner/Moderator、caller RPC、immutable監査・CAS・冪等性
2. done: 053〜055 staging適用、既存停止/退会/AIとの接続
3. done: 9管理領域＋staff、確認UI・限定投影・モバイル対応
4. done: DB317、unit32、metadata16、local UI22、MVP21 suites
5. done: Hosted UI22・追加10・モバイル5、axe0・秘密走査・cleanup・最終COMPLETE判定
6. done: SPEC/ACCEPTANCE/権限/runbook/HANDOFF。develop/v2へ検収記録をローカルcommit

## Do not
production DB/Auth/Storage/moderation/flags/deploy/migration、live Stripe、production本文/PII閲覧、main merge、既存SQL改変、秘密出力、実OpenAI再送。

## Validation
424 checks + MVP21 suites PASS。型/関連lint/build/diff PASS。A〜P/DoDをV2_5_ACCEPTANCEへ対応付け。Cookie0、有効合成session/refresh token0、停止設定復元。

## Expected output
V2.5 COMPLETE（staging / Hosted Preview）。Production Changes NONE / Live Billing OFF。次はV2全体の統合検収・本番移行準備。V2.2実AI429はKnown Issue。

## Updated at
2026-10-23 JST
