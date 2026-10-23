# AI_TASK

## Status
in_progress

## Objective
最新mainとV2.1〜V2.5を統合し、V2 Release Candidateの移行・統合E2E・安全性・Hosted Previewを検収する。

## Context
ユーザー添付1d1b7e1c。開始develop/v2 cfd91f3、remote main 402719b。main→V2方向のみ。Buffer本番を維持し、本番には触れない。

## Tasks
1. main統合と履歴保持
2. 適用済み本番SQLを固定、V2旧040〜055→canonical042〜057の対応・二重適用防止
3. 隔離fresh DB再構築、統合・権限・競合・退会・Buffer/MVP回帰
4. stagingのみsynthetic AI / Stripe test E2Eと新Hosted RC Preview検収
5. RC移行/復旧/既知課題文書、全条件を根拠付きで判定、RC branch/tag

## Do not
本番DB/Auth/Storage/設定/deploy/migration、V2→main、live Stripe、実OpenAI再送、秘密表示、既存差分破棄、force push。

## Validation
Canonical順序/hash/旧staging履歴、fresh DB、統合E2E、権限/競合/退会、Buffer/MVP、型/lint/build、Hosted操作/レスポンシブ/axeを実結果で記録。未確認をPASS扱いしない。

## Expected output
V2_RC_ACCEPTANCE / MIGRATION_MATRIX / BACKUP_RESTORE_PLAN / PRODUCTION_ROLLOUT / KNOWN_ISSUES、HANDOFF、RC固定、Production Changes NONE。

## Updated at
2026-10-24 JST
