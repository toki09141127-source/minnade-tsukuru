# Repository instructions

## 作業開始時

1. `docs/AI_HANDOFF.md` と `docs/AI_TASK.md` を必ず読む。
2. `git status`、現在のブランチ、未コミット変更を確認する。
3. 既存の未コミット変更を勝手に取り消さない。
4. `docs/AI_TASK.md` は次にCodexが実行する単一タスクの指示書とする。Status が `pending` で具体的なタスクがある場合は、ユーザーの最新の明示指示と本書の制約の範囲内で最優先に実行する。`pending: none` や空欄は未登録を意味し、`docs/AI_HANDOFF.md` の次の作業を自動的にタスクとして実行しない。
5. タスクの実行開始時に `docs/AI_TASK.md` の Status を `in_progress` に更新する。既に `in_progress` の場合は、途中経過と実際の状態を確認してから再開する。

## 作業中

- 大きな変更の前に、目的・変更範囲・影響・検証方法を提示する。
- 依頼範囲外の変更を勝手に行わない。
- 秘密鍵・環境変数・個人情報を出力しない。
- ユーザーの明示的な指示なしに commit / push / deploy しない。

## 作業終了時

1. 実行したタスクが完了したら `docs/AI_TASK.md` の Status を `done` に更新する。未完了なら `in_progress` のままにし、残作業・停止理由を記録する。Status 更新時には Updated at も更新する。
2. 作業結果は `docs/AI_HANDOFF.md` に記録し、最新状態に更新する。変更ファイル、検証結果、未対応課題、次の作業を記録する。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
