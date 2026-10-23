# AI_TASK

## Status
in_progress

## Objective
V2.4 Free/Plus/Pro・課金・AI creditをstaging/test modeだけで実装し検収する。

## Context
添付37f0808bの要件。develop/v2、開始HEAD3cc489a、clean。既存047まで不変。V2.2実AI429は再送しない。

## Tasks
1. done: billing/credit/room entitlement/AI profile設計とDB実装（048〜052 staging）
2. done: Stripe test adapter/Webhook/ライフサイクル/退会整合
3. done: Pricing/Billing/Usage/Customization UI
4. in_progress: unit/DB/security/concurrency/staging/Hosted Preview/回帰
5. done: SPEC/ACCEPTANCE/CREDIT/HANDOFFとV2 branch commit（実装・検収記録、最終結果はHosted後に追記）

## Do not
production DB/migration/deploy/payment、live mode、実カード、main merge、Buffer混在、秘密出力、既存差分破棄。

## Validation
添付Definition of Done。合成providerと実Stripe testを区別し、未検収をPASSにしない。

## Expected output
V2.4結果・証拠・残件。Production Changes NONE / Live Billing OFF。

## Updated at
2026-10-23 JST

## Current checkpoint
旧Preview 4wqvksxt4でHosted77 checks PASS。ただし降格予約の実Stripe P1を追加検出し、efebbb4で修正。unit32・型/lint/build、修正済みlocal build＋実Stripe Test Clock16 PASS。DB213など変更のない既存証跡を再利用。新Preview8531792ul READY。USER APPROVAL REQUIRED: 新URL限定のCookie取得・実操作・署名test Webhook転送（具体的URLを提示済み）。旧Cookie削除・4合成refresh session終了・forwarder/browser停止済み。新Previewへ流用なし。最終Hosted重点再検証前につきPARTIAL。Production NONE / Live OFF / OpenAI再送0。
