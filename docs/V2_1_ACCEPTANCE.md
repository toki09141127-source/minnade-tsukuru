# V2.1 検収結果

Status: **COMPLETE（ローカル実装・実staging検収の範囲）**
Updated: 2026-10-23 JST
Production changes: **NONE**

## 実行範囲

- branch: develop/v2、worktree: C:/dev/minnade/minnade-tsukuru-v2、base: a325926cda1e52f84eb948c23f5dd8b1ea3948b4。
- staging: fwqucffxdmbdczspkcyr。Auth12合成アカウント、専用TESTルーム、合成16×16 PNGのみ使用。
- production joedeuyrzimqyjapqpyhへの接続・DB/Auth/Storage変更・migration・deployなし。main mergeなし。
- 最新production buildをlocalhostで起動し実stagingに接続。V2専用Vercel Previewは配信していない。
- Buffer作業を取り込まず、元worktreeの差分を保持。既存migration001〜028は元checkoutと28件すべてbyte/hash一致。

## Definition of Done

- Roles / Creator / Core / Member: PASS。Member表記、Creator1、Core最大4、DB/RPCで権限再確認。Creatorの未公開論理削除を最終Web UIで確認。
- Core workflow / resignation / demotion: PASS。拒否だけ3回消費、満員ではpending維持、辞退承認前はCore権限保持、承認/降格直後にMember権限へ変更。
- Capacity / room creation / consent: PASS。全人間を含む最大50、最終枠の同時join、説明/ジャンル/締切/同意、capacity/deadline/AI方針の不変性。
- Kick / voluntary leave: PASS。追放と退出を区別し、退出だけ再参加可能。遅延upload/postと競合しても権限を残さず、過去貢献を保持。
- Highlight / production log: PASS。Creator/CoreのみCAS更新、時系列・投稿者・日時・添付、roomの匿名化済み節目イベント。
- Search / filters: PASS。本文・投稿者名のserver検索、all/highlight/image/mine、bounded cursor。実UIでも検索・画像filterと解除済みhighlightの非表示を確認。
- Public exclusion: PASS。内部表示を維持し公開から除外。hidden/deleted/PII/未レビューをRLS/画像認可でも拒否。
- Completed draft / blocks / genre templates: PASS。7共通block、6ジャンル見出し、追加/編集/削除/上下移動、同room台帳画像候補、未知type/余分なfields/HTML/PII拒否。
- Draft concurrency: PASS。version競合で409、入力を保持し最新版との比較を表示。無言上書きなし。
- Forced publication / incomplete fallback / snapshot: PASS。期限・ロック・公開時再検証、未完成表示、AI補完なし、snapshot固定、退会中のpending処理を限定capabilityで閉じる。
- Work / public log: PASS。作品から「この作品ができるまで」へ遷移。公開添付の実bytesを合成PNGのSHA256と照合。
- Security / race conditions: PASS。直接RPC/API権限拒否、RLS/ACL/private schema、同時join/Core/申請/highlight/draft/publish、kick/leave対post/upload、公開対編集。
- Mobile / accessibility: PASS（viewport）。320/375/390pxで作成/room/公開log、390pxで主要制作操作。label、キーボード作成、確認modal初期focus・Escape取消・focus復帰。
- Regression / build / staging E2E: PASS。以下の根拠参照。

## staging E2E A〜K

- A: Creator作成→Member同意join→文章/実画像→highlight→draft→限定公開→Work→公開log。最新ビルドの別合成room作成も再確認。
- B: Member Core申請→Creator承認→Core highlight/画像入りdraft保存。
- C: Core最終枠の並行承認は成功1件。5人目は成立せずpendingを維持。
- D: 拒否3回の後、4回目を拒否。
- E: kick後のrejoin/post/upload/Core申請を拒否。
- F: voluntary leave後は再join可能。kickと別状態。
- G: Core辞退pendingで制作可、Creator承認後Member→leave。
- H: excluded投稿はroom内で見え、公開logでは非表示。
- I: 空draftの合成roomを安全な未完成作品として公開。
- J: 同時2workerの処理数2件/0件、対象2roomにsnapshot各1件。
- K: Creator/Coreの競合保存で409、UI入力を保持。

## 実行結果

- docs/v2-local-result.json: 隔離native PostgreSQL **81項目PASS**。監査済みschema + 001〜028 + 040〜043、別接続による実transaction競合。
- docs/v2-unit-result.json: **26項目PASS**。domain/template/validation/環境flag。
- docs/v2-staging-result.json: **33項目PASS**。実stagingとWeb UI/API/Storage。
- docs/v2-final-ui-result.json: **7項目PASS**。最終ビルドの画像bytes/検索/作成/確認modal/未公開論理削除。
- docs/v2-staging-publication.json: 並行公開scenario PASS、対象2roomのみ、各snapshot1件。
- 既存 docs/run-security-checks.cjs: **21スイートPASS**、exit 0。login/profile/room/create/join/post/upload/works/likes/report/account deletion等のoffline security regression。過去の実機検収を今回のV2実機検収として数えない。
- tsc --noEmit: PASS（最終UIで再実行）。
- 対象ESLint: **0 error / 0 warning**（V2 code/routes/scripts、最終追加テストも再実行）。
- build: PASS（staging設定、next build --webpack）。その後は検証script/docsだけ変更。既存middleware→proxy deprecation警告あり。
- git diff --check / staged diff --check: PASS。
- 全検証server停止済み。秘密形状走査は候補0（不存在の数学的保証ではない）。環境値・token・私的fixtureはGit対象外。

## staging schema検収・後片付け

040〜043を個別transactionで適用しSuccessを確認。manifestに実ファイルhashを記録。新3表RLS、必要3index、5trigger、authenticated create許可、anon write/Service Role actor spoof/private read/snapshot update拒否を確認。

限定公開のための一時helperは撤去、advisory/row lockをROLLBACK、immutable trigger有効1件。最終READ ONLYではhelperなし、対象snapshot2、RLS3、非V2公開待ち7件（検収前後不変）、fixture lockなし。初回の読み取り専用照合SQLは存在しないhidden_atを参照して拒否されたため、監査済みis_hiddenへ修正して再確認。変更は行われていない。

## 修正した発見

余分なJSON field経由のPII、画像MIME filter、遅延upload、退会完全一致capabilityの継承、room_join_requests.updated_at triggerとの整合、旧MVP公開関数の変数名衝突、退会中のpending申請を閉じる際のfence衝突を修正。公開workerだけに限定した043を追加し、通常UPDATEの拒否を保持した。

UIはhydration前送信を抑制し、認証token更新時に未保存draftを消さず、編集値に影響されないaria-labelを使用。dev HMRによる検収中のnavigationを避けるため最終検収はproduction buildを利用。最終補完UI検査の最初の失敗は、辞退pending権限テストで解除したhighlightを表示対象と誤認した検収側の期待値。DB事実に合わせて修正後PASS。

## Known issues / evidence limits

- 実Android/iPhoneのV2操作は未実施。viewport PASSを実機PASSとは扱わない。
- 本番反映・hosted V2 Preview・公開cronの定時配信は今回行っていない。実stagingの公開関数を限定2fixtureに対して検収した。
- 既存投稿経路とのロック順でdeadlockが起きる場合、transaction全体が中止される。検査では一度だけ再試行して権限状態を確認。UIは明示エラー後の再試行が必要になる場合がある。
- PII検出は完全ではない。権利/公開確認と運営hideを維持。snapshot画像の読み取りでも最新の安全認可を優先する。
- V2_ENABLEDはUI/API停止用で、直接RPCや既存publish workerの全停止スイッチではない。
- E2Eログに意図的409と画面遷移時のERR_ABORTED/Failed to fetchが残る。最終操作は成功し、原ログを正常0件へ改変していない。
- 退会とupdated_at triggerの整合修正はV2/stagingにのみ適用。本番の最新状態の再監査や反映は別の作業。
- 本番公開判定とは別。V2.2のAI Creator設計/実装を分離して開始できるが、このtaskでAI・課金・Bufferは実装しない。

## 変更範囲とcommits

DB/API: 46268a9。UI: 71629ad。検収・spec・manifest・scriptsを後続のV2限定commitで保存。
app/api/v2、app/components/v2、lib/v2、rooms/create・rooms/[id]・works/[id]のV2分岐、works/[id]/log、新migration040〜043、scripts/v2、V2検収docs。
push / main merge / production deploy: なし。

最終Git検査: Gitの改行正規化が040/041の適用hashと異なったため、新V2 4ファイルだけ-text属性で実バイトを保持。既存001〜028と作業中SQLは変更せず、indexの4hashも適用manifestと一致させた。SQL処理内容の変更ではない。
