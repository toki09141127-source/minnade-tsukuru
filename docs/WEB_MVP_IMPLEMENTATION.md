# Web MVP ローカル実装と公開手順

2026-10-21。ローカル案。production未変更。100人公開の承認書ではない。

## 実装済みの範囲

- 旧join/core/debug/expireの停止は既存差分を保持。現行UIの呼び出し先は維持。
- 添付はserver生成uploadIdを使用。client指定attachment_urlは拒否。既存作品の読み取り経路は維持。
- 新uploadは認証、可視/open room、active membership、4,000,000 bytes上限、MIME/拡張子/header一致を確認し、台帳reserved→Storage upload(upsert=false)→uploadedとする。完了確認に失敗したものは投稿に使えない。
- ローカルSQL `supabase/migrations/202610210001_attachment_ledger.sql`：attachment_uploads、post_requests、mvp_rate_limits、service専用RPC。投稿・添付消費・再送記録は同じtransaction。同一actorをadvisory lock、room→membership→uploadの順にロック。本人・room・期限・status・未使用・roleを再確認する。
- request payloadはSHA256のみ保存し本文を二重保存しない。ただしactor UUID/hashも保持方針の対象。保持期限未確定。
- anon/authenticatedには新台帳アクセス/RPC実行を許可しない。postsの直接INSERT/UPDATE/DELETEはtable/column grants両方を剥奪する案。既存RPC経由の迂回は別監査が必要。
- API rate limitは検証済actor単位。posts20/min、uploads10/min、join10/min、core10/min、like30/min、reports5/min、rooms3/hour。拒否429、DB障害503。固定窓の境界で最大2窓分のburstは起こり得る。複数アカウント/IP攻撃を防ぐものではない。
- cronはCRON_SECRET Bearer header必須。query key不可。open・期限到来・明示is_hidden=false・deleted_at=NULLのみ公開。既に公開済みなら更新0。final無しでも制作ログ公開という既存方針を保持。
- TermsConsentGateのメール由来username生成をランダムUUIDへ。公開プロフィールselectはusername,bioだけ。既存usernameデータは取得/変更していない。
- 既読更新componentを本人確認付き既存seen APIへ移行。DBのlast_seen_at UPDATE権限は変更しない。
- いいねは可視roomの存在確認、検証済本人のみ、失敗を成功扱いしない。toggleの並行実行/重複には別途原子化が必要。
- 確認/参加同意modalに名前・初期focus・Tab循環・Escape・focus復帰。参加同意は閉じるとunmountして同意チェックを初期化。投稿文字数/添付サイズの表示と入力保持を追加。

## feature flagと互換性

`MVP_DB_GUARDS_ENABLED=true`はserver側だけで使用。新DBがない状態でtrueにしない。
未設定/falseでは新規添付uploadを503、投稿のuploadIdを503、旧path指定を400にする。本文のみは既存経路で継続可能だが、この経路の再送原子性とDB連打制限は有効にならない。falseのまま100人公開合格とはしない。
trueでは本文のみも新RPCを利用。既存公開作品は旧pathのまま署名read可能で、所有者を推測したbackfillは行わない。旧tab/外部clientのpath入力は400になるためreload案内が必要。
新しいUpload UIは4MB以内のPNG/JPEG/GIF/WebP/MP4/WebM/PDF/TXTのみ。従来の大容量/別形式は非互換。magic headerは完全なdecoder/ウイルス検査ではない。EXIF除去、PDFの能動要素、配信時のContent-Dispositionを公開前に決める。

## FK・削除・cleanup

attachment owner/room/postのFKはSET NULL。post_id消失でもused_atを残し再利用を拒否する。Storageとは直接FKを張らない。元のposts→rooms CASCADEは合成fixtureで検証したが実Triggerとの組合せは未検証。
account deletionの全体方針は未確定。bound/使用済みobjectをowner削除だけで消すと共同作品を壊すため、自動cleanup対象にしない。退会者名・投稿本文中の個人情報は個別判断が必要。
未使用TTLは仮24時間。cleanup workerは未実装で自動削除なし。次の実装では、未使用かつ期限切れをFOR UPDATE SKIP LOCKEDでclaim→cleanup_pending→Storage削除→deleted。bindとclaimを同じ行lockで排他。lease/再試行/削除不存在の扱いを追加し、dry-run件数検証後だけ有効化する。Storage成功後DB失敗のreserved orphanも対象候補。使用済みは別手順。
rate counterは活動窓ごと増える。古い窓の定期削除、post_requestsの保持/消去、NULL ownerの照合を公開前に設計・承認する。今回worker・scheduler追加なし。

## 安全な移行順序（USER APPROVAL REQUIRED）

1. 実RPC6本/Trigger/Storage policy/CHECK/対象relation/public_profiles定義を追加read-only監査。既存DDLを保存し、実ユーザーデータを使わないstagingを準備。
2. 無条件SELECTとrooms直接書込み、Storage直接書込み、SECURITY DEFINER迂回を修正する別migrationをレビュー。今回添付migrationだけではP1は解消しない。
3. stagingにこの案を適用。新table/functionの存在衝突、service_role schema権限、既存投稿Trigger、旧clientの直接posts DML依存を検証。DDLのlock時間を測定。
4. 2接続以上で同upload異key/同key、退室・期限公開・cleanupとの競合、Storage応答消失/DB障害、旧作品署名read、アカウント削除方針を確認。
5. バックアップ/復旧確認後、書込みを止める時間帯と旧client reload方針を合意。承認されたDB/API/UIを順に導入し、最後にserver flagをtrue。cron schedulerがBearerを送ることを確認。
6. 小人数canary→監視→100人。認可違反、署名漏れ、投稿重複、異常な4xx/5xx、費用超過なら募集停止。

## rollback案

まず新規書込み/新uploadを停止、flagをfalseにして本文経路への戻し可否を確認する。台帳/used_atを消さない。旧pathを受け入れる脆弱APIや広いGRANTへ戻さない。
RPC/DB変更の撤回は承認済み前方修正を優先する。すでに作成した投稿/objectをDROP TABLEで消さない。互換readを維持し、新規書込み停止中に合成stagingで復旧を再現。実rollback SQLは実スキーマ未確定のため作成/実行していない。

## 残るP1/P2/P3

- P1：実DBの無条件SELECT、posts/rooms直接DML、公開SECURITY DEFINER RPC/Storage policyの未確認部分。本番未変更。新APIを通さない迂回が残る。
- P1：既存6 RPCの認可/人数競合、参加処理と同意保存の非原子性。supporter count→upsertも並行時に枠超過があり得る。モックで競合安全とは証明しない。
- P1：退会APIの存在しないprofiles列/user_id条件、Auth削除を妨げるNO ACTION FK、作品/名義/個人情報の保持方針。安易な列名修正だけでは解消しないため今回挙動未変更。
- P1公開ゲート：過去メール由来usernameが既存データに残っている可能性。存在自体は未確認。対象者の是正手順が必要。
- P2：room作成とcreator membership追加が別transaction、core同意失敗時の部分成功。実RPC定義確認後に原子化。
- P2：未読のhidden/deleted post/room、NULL混在の過少集計は今回API/SSRとも修正・12検査成功。REST行数上限/全履歴scanは残る。旧mark-readはlast_read_atを使いcaller検索は自身のみ。今回は停止せず互換調査を残す。
- P2：like toggle並行性、期限切れuploadの409再試行ではfileの選び直しが必要。投稿確定後fetchPosts失敗の見せ方も実機検収対象。
- P2：upload内容検査/EXIF/cleanup/保持期間、Auth側rate制限・CAPTCHA・BAN運用・通報受付担当、実機/負荷試験未完。
- P3：img最適化警告2件、既存middleware命名警告、長いfilename表示/狭い画面の実測。

## ローカル検証の限界

`mvp-database-check.cjs`はPGliteの合成PostgreSQL、実Supabase/Storage/実Trigger/複数接続を代替しない。APIテストは偽DBで実行。未ログインのローカルブラウザ導線/失敗表示を確認。実メール、ログイン成功、スマホ操作、100人負荷試験、本番設定確認は未実施。ビルド成功は上記の代替ではない。
## 最終補足

依存更新後のbuildは成功したが、Next内部process.cwdのEdge Runtime警告も残る。middlewareを本番設定と同じstagingで検証する。開発用bracesのHigh指摘5packagesはWEB_MVP_DB_AND_DEPENDENCIES.md参照。
投稿一覧にはis_hidden=falseも追加し、既存DBの広いSELECT policyがあってもUIで非表示投稿を描画しない。ただし直接RESTのアクセス制御を代替しない。
