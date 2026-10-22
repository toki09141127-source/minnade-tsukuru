# 追加ローカル対策と残課題（2026-10-21）

## 適用範囲

ローカルのみ。本番へのデプロイ・DB接続はなし。前回監査の全P1が解決したわけではない。SECURITY_AUDIT_2026-10-21.mdは当初の証拠を維持し、本書を最新差分として参照する。

## 実修正

- app/api/rooms/expire/route.ts：無認証の期限公開DB更新を廃止。POST 410/no-store、admin importなし。cron参照先は別の/api/cron/publish。
- app/api/debug/buckets/route.ts：GET 410/no-store。bucket列挙/URL/設定有無開示を廃止。
- app/rooms/join/route.ts：同意/人数/role維持を欠く重複旧POSTを410化。
- app/api/rooms/expire/join/route.ts：同意/招待なしのis_core設定旧POSTを410化。
- app/api/rooms/join-supporter/route.ts、request-core/route.ts：is_hiddenが明示false、deleted_at=NULLのroom以外は404。可視open roomの既存動作とactive core保持をテスト。
- app/api/posts/delete/route.ts：active membership（left_at=NULL）必須に合わせる。通常投稿者の削除は維持。
- 上記3既存ハンドラのcatchをunknown、2同意parserの引数型を具体化。規約versionのサーバー検証など新たな認証仕様は今回追加していない。

停止4ルートはapp/components/libと設定でcaller未検出。外部クライアントの利用有無は未調査。削除ではなく明示410にして失敗を検出可能にした。新UIへ危険な旧payloadを自動forwardしない。
ロールバックはこの7ファイルの今回差分だけを手動で戻せるが、危険経路を再開するrollbackは推奨しない。旧APIの復帰が必要なら安全な互換仕様を先にレビューする。開始時の9ファイルは触らない。

## 参加APIの状態・未解決境界

- 現行UI: /api/rooms/join-supporter、request-core、join-core-first-come、join-core-by-invite、approve-core、reject-core、leave。RoomDetailClient呼出しを確認。
- supporter：同意文字列必須、role固定、active既存者を維持、退出者は再参加可。45枠countとupsertは別処理で競合余地。新規creator/core昇格はしない。
- request-core：同意/承認ON/visible openを確認。退出者/非参加者申請は現仕様として許可。pending重複checkとinsertは非原子的。
- first-come/invite：同意と本人認証をAPIで確認、人数・再参加・roleはRPC本文依存。招待コードを知ることだけで十分とは未確定。RPC後同意UPDATEが非原子的。
- approve/reject：actorを検証しRPCへ渡すが所有者判定・人数・roleの最終保証は未監査のRPC。role昇格の可否は現物本文確認まで断定しない。
- leave：creator不可、長時間core不可、active限定。旧joinでcore→supporterに落としてから退出する迂回が残る。
- /api/rooms/join：JoinButton参照あり、通常BoardClientでは到達しにくいが完全未使用と断定しない。deprecated候補。認証のみで同意/人数を迂回、既存creator/coreをsupporterに降格、is_core残存。P1継続。
- /rooms/join、/api/rooms/expire/join：今回停止。後者のis_core=trueが現DBでrole=coreになるかは未確認。
- /rooms/[id]/core-request：Cookie本人だが同意検査なし、authenticated INSERTが現在DBで拒否されるため機能不一致。deprecated候補。
- /rooms/[id]/core-requests：所有者限定Cookie一覧。OwnerCoreRequestsPanelは/api/rooms/...を参照し実パスと不一致。
- /rooms/[id]/core-approve：所有者チェックはあるが人数/同意/open検査なし、承認→membership insertが非原子的。P1継続。旧Panelパス不一致を安易に直すと危険APIをUIから有効化する。
- /rooms/[id]/core-reject、core-revoke：所有者限定。revokeはmembership物理削除、現行role/退出仕様との互換性不明で統合候補。

## 新たに確認したP2：cron認証の不一致

app/api/cron/publish/route.tsはURL query keyだけを見る。vercel.jsonは/api/cron/publishを指定。[Vercel公式](https://vercel.com/docs/cron-jobs/manage-cron-jobs)のCRON_SECRET送信はAuthorization: Bearer。現在コードはこのheaderを受理せず401になる。デプロイ環境の実行失敗・secret設定は未確認。外部schedulerがquery keyを使う可能性も残る。URLに秘密を載せる設計はログ等への露出要因。
提案はheader認証への移行、query廃止、debug値削除、過去URLログを秘密非表示で点検。外部scheduler互換性と公開運用に触れるため今回は変更しない。USER APPROVAL REQUIRED。

## 残るP1 / P2 / P3

P1：無条件SELECT・招待コード等全列の到達性、直接posts UPDATEでpath/role条件を迂回可能、同一room他人path再使用、旧/api/rooms/join、旧core-approve。6公開SECURITY DEFINER RPCは重大な要調査であり本文未確認の攻撃成功と同一視しない。
P2：join競合/同意時刻とversionのclient依存、既読GRANT不一致、account delete列/FK不一致、cron、toggle-mark可視性、未読集計差、プロフィール同期、管理CLI引数秘密。
P3：古いis_coreとroleの二重概念、例外応答の統一、server-only宣言、middleware移行警告。重要度は露出/悪用可能性が判明したら見直す。
新規の独立したP1を確証付きで追加したものはない。既知P1のローカル入口を一部閉じたがDB迂回は残る。

## 検証範囲

docs/security-audit-check.cjsは偽DBだけで旧GAP再現と修正後拒否を確認。監査40ケース、添付58ケース。GAP行は未解決を表す。実DBのRLS/Trigger/並行性、実Storage、外部caller、ストア審査は検証していない。最終type/build/lintログとAI_HANDOFFを参照。

## 旧API整理の追加更新（2026-10-21）

今回ユーザー承認により/api/rooms/joinと/rooms/[id]/core-request・core-approve・core-reject・core-revokeをローカル410化。JoinButton/OwnerCoreRequestsPanelを除去し現行RoomDetailClientにUIを一本化した。本文の「旧join/旧coreは保持・未解決」はこの変更前の状態を示す。最新詳細はLEGACY_JOIN_CORE_RETIREMENT.mdとAI_HANDOFF第29節。DB直接DML/RPC/添付所有権は未修正、本番未適用。
