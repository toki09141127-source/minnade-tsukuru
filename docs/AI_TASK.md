# AI_TASK

## Status
in_progress

## Objective
V2.5 運営管理画面・基盤を develop/v2 / staging / Hosted Previewで実装・検収する。

## Context
添付66dbe3b8の要件。開始HEAD b794e0e、worktree clean。V2.4 COMPLETE。最新migration052。staging fwqucffxdmbdczspkcyr、production joedeuyrzimqyjapqpyhは操作禁止。V2.2実OpenAI429は再送しない。

## Tasks
1. done: 既存moderation/退会/RPC/flagsと接続するadmin権限・DB停止設計
2. done: 053以降の追加migration、Owner/Moderator、監査・CAS・冪等性・停止ガード
3. done: /admin・/api/admin、9管理画面、確認操作・安全なメタデータ投影
4. done: 隔離DB/競合/権限/プライバシー/回帰、staging合成E2E
5. in_progress: Hosted Preview、responsive/axe、秘密走査、cleanup、最終判定・docs・V2 commit

## Do not
production DB/Auth/Storage/moderation/flags/deploy/migration、live Stripe、production本文/PII閲覧、main merge、既存SQL改変、秘密出力、実OpenAI再送。

## Validation
添付A〜PとDefinition of Done。Owner/Moderator/一般userをDBとHosted実操作で照合。停止と同時書込・退会副作用の境界を検証。未確認はPASSにしない。

## Expected output
V2_5_ADMIN_SPEC、V2_5_ACCEPTANCE、ADMIN_PERMISSION_MATRIX、ADMIN_OPERATIONS_RUNBOOK、AI_HANDOFF。Production Changes NONE / Live Billing OFF。

## Updated at
2026-10-23 JST
