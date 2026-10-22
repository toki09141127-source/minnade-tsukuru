# 旧join・core APIの停止と互換性確認

2026-10-21。ローカルのみ。本番接続/DB設定変更/commit/push/deployなし。

## 呼び出し元と判断

- /api/rooms/join：唯一のUI呼出しはJoinButton→BoardClient。RoomDetailClientはactive supporter/core/creatorかつopenのcanPost時だけBoardClientを描画する。一方JoinButtonはBoardClient内の!isMember条件なので通常画面では到達しない。旧APIは同意/人数なしupsertで既存core/creatorをsupporterへ落とすため停止。
- /rooms/[id]/core-request：ソース内callerなし。旧Cookie本人INSERT、同意なし。現行RoomDetailClientは同意付き/api/rooms/request-coreを使用する。停止。
- /rooms/[id]/core-approve、core-reject、core-revoke：OwnerCoreRequestsPanelが似た名前を使うが、呼出し先は存在しない/api/rooms/{id}/core-*。next.configにrewriteなし。実際の旧/rooms/...はUIから直接呼ばれず、HTTPでは到達可能。承認の人数/同意不足や非原子処理を残さないため3本停止。
- OwnerCoreRequestsPanelはpageで常時描画される重複UI。現行RoomDetailClient内にcreator限定pending一覧・Bearer承認/却下があるため、旧Panelのimport/mount/fileを除去。
- JoinButtonもimport/fileを除去。BoardClientの非参加者fallbackは上の参加メニューを案内する文章に変更。同意なし参加へforwardしない。
- /rooms/[id]/core-requests GETはCookie本人とroom owner確認の読取り専用。今回は変更しない。現行pending一覧はRoomDetailClientが本人Supabase clientで取得する。
- 全app/components/libとリポジトリソースをrgで検索。新旧のAPI名、動的path、component importを確認。旧UI呼出し残存なし。外部クライアント/古いブラウザtab/独自bookmarkの実利用履歴は取得していないため「外部でも完全未使用」とは断定しない。

## 互換性の決定

旧書込み5本はPOST 410、Cache-Control:no-store、固定error。auth/JSON/paramsを処理せずSupabase moduleもimportしない。壊れたJSON、Cookie、Bearer、満員、creator/supporter/退出済/非参加/匿名のいずれでも書込み/RPCなし。
旧payloadはroomIdのみ、またはCookie+requestIdで、現行のBearer+roomId+requestId/consent契約とは異なる。自動リダイレクトや透過forwardで不足同意を補わない。古いクライアントは410になるので画面再読込みと現行参加/申請操作が必要。
取消(revoke)は現行UI/APIに同等の安全な操作がない。旧Panelからの操作も不一致URLで機能していないが、外部callerの依存は不明。旧物理membership削除は停止し、新しい取消機能は今回追加しない。必要なら作品/参加履歴・role・同意の仕様を確定した独立タスクとする。
現行room作成/同意付きsupporter/core参加/申請/承認/却下/退出のURL、Bearer、body、戻り値は変更していない。ページの既存params PromiseやRoomRow型修正も保持。

## 修正ファイル

- app/api/rooms/join/route.ts
- app/rooms/[id]/core-request/route.ts
- app/rooms/[id]/core-approve/route.ts
- app/rooms/[id]/core-reject/route.ts
- app/rooms/[id]/core-revoke/route.ts
- app/rooms/[id]/page.tsx（旧Panelのimport/mountのみ除去）
- app/rooms/[id]/BoardClient.tsx（旧JoinButtonのimport/描画を除去）
- app/rooms/[id]/JoinButton.tsx、OwnerCoreRequestsPanel.tsx（削除）
- docs/security-audit-check.cjs、AI_TASK/AI_HANDOFF、本書と検証ログ。

## 検証と限界

開始時40ケースで旧join/旧承認GAPを再現後、期待値を拒否へ更新。停止5本×5状態の偽DBケースではservice dependency import自体も禁止し、行内容不変/無呼出しを確認。旧join→leaveでも長時間coreは403となる。
現行承認/却下は未認証401、検証済みactor（body userId偽装を無視）、RPC NOT_CREATOR→403、承認時の別room request→404を確認。これらはRPCをstubしてAPI契約を検証するもので、実RPCがNOT_CREATORを正しく発生させることや人数競合の保証ではない。
UIはソース参照/契約確認とproduction buildで確認。実ログインブラウザE2Eは行っていない。
最終検証結果はAI_HANDOFF第29節。実DBへの直接REST/RPCアクセス制御、公開EXECUTE、同意のserver検証、参加の原子性は未修正。旧API停止を全認可問題の解決と扱わない。

## rollback/次の作業

安全な復旧は現行UI/APIを維持した前進修正。旧APIを無条件upsert/insertへ戻さない。履歴差分はGitに残るが、既存差分全体をresetして戻すことは禁止。
次はRPC/Trigger/Storageの追加読み取り監査を事前提示し、人数・所有者・room状態・同意・公開EXECUTEを確認する。その後RLS/GRANT/原子化をステージングで検証する。実DB変更と新しいrevoke仕様はUSER APPROVAL REQUIRED。
