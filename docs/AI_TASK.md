# AI_TASK

## Status
done

## Objective
V2.4 Free/Plus/Pro・課金・AI creditをstaging/test modeだけで実装し検収する。

## Context
添付37f0808bの要件。develop/v2、開始HEAD3cc489a、clean。既存047まで不変。V2.2実AI429は再送しない。

## Tasks
1. done: billing/credit/room entitlement/AI profile設計とDB実装（048〜052 staging）
2. done: Stripe test adapter/Webhook/ライフサイクル/退会整合
3. done: Pricing/Billing/Usage/Customization UI
4. done: unit/DB/security/concurrency/staging/Hosted Preview/回帰
5. done: SPEC/ACCEPTANCE/CREDIT/HANDOFFとV2 branch commit（実装・検収記録、最終結果はHosted後に追記）

## Do not
production DB/migration/deploy/payment、live mode、実カード、main merge、Buffer混在、秘密出力、既存差分破棄。

## Validation
添付Definition of Done。合成providerと実Stripe testを区別し、未検収をPASSにしない。

## Expected output
V2.4結果・証拠・残件。Production Changes NONE / Live Billing OFF。

## Updated at
2026-10-23 17:02 JST

## Current checkpoint
V2.4 COMPLETE (staging / Stripe test mode). Latest corrected Preview 8531792ul / source efebbb4: schedule regression 7 + UI 24 PASS, six widths and axe 0. Original Hosted77 and unchanged DB/credit/Checkout/security evidence retained with source/URL. Pending operations/events 0. Fresh exact-host Cookie deleted, four reused synthetic refresh sessions revoked, listener/relay/browser stopped, test processes 0. No new test users, application or migration changes in the final acceptance turn. Production NONE / Live OFF / OpenAI retries 0 / no push. V2.5 can start as a separate task; V2.2 real-AI429 and future production prerequisites remain explicit Known Issues.
