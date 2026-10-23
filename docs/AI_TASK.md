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
5. in_progress: SPEC/ACCEPTANCE/CREDIT/HANDOFFとV2 branch commit

## Do not
production DB/migration/deploy/payment、live mode、実カード、main merge、Buffer混在、秘密出力、既存差分破棄。

## Validation
添付Definition of Done。合成providerと実Stripe testを区別し、未検収をPASSにしない。

## Expected output
V2.4結果・証拠・残件。Production Changes NONE / Live Billing OFF。

## Updated at
2026-10-23 JST

## Current checkpoint
実装commit7f89628、修正5c37a32。DB213、unit31、実Stripe16＋clock11、local UI25＋支払状態4＋共同制作UI28、型/lint/build・MVP回帰PASS。最終Preview 4wqvksxt4（deploy JSONで状態確認）。新Preview限定Cookie/Webhook転送の承認待ち（USER APPROVAL REQUIRED）。Production NONE / Live OFF。
