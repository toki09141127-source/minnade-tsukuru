# Service Role利用台帳

2026-10-21、ローカルソースと既存監査に基づく。実APIやRPCは呼んでいない。各パスはrepo相対。認証B=BearerをgetUserで本人検証、C=Cookie sessionをgetUserで検証、公開=意図した未認証read。bodyのuserIdを本人としない。N=DB/Storage権限整備後に通常clientへ代替検討可能、S=限定server権限を維持する合理性あり、X=廃止/統合優先。現在のRLSのまま通常clientへ変える推奨ではない。

## API（ファイル→URL、用途・境界・評価）

- app/api/posts/create/route.ts → POST /api/posts/create。投稿insert。認証B、visible/open/active/final role確認。入力room/type/text/path。N/S：原子的RPCへ集約。P1、client pathの所有者未検証、直接DML迂回も閉鎖する。
- app/api/posts/delete/route.ts → POST /api/posts/delete。本人投稿論理削除。B、owner/open/active（今回修正）。入力postId。N、本人列限定RLS/RPC案。P2、room非表示・競合・既削除の応答統一は残る。
- app/api/posts/toggle-mark/route.ts → POST /api/posts/toggle-mark。mark更新。B、active core/creator、post room一致/未削除。入力roomId/postId。N/S、他者投稿への許可列限定RPC。P2、room状態/hidden再検証が必要。
- app/api/uploads/route.ts → POST /api/uploads。private bucketアップロード。B、visible open room/active。入力file/room/type、pathはサーバー生成。S、台帳/bytes検証/quota導入まで直接client置換しない。P1、所有権台帳なし。
- app/api/uploads/sign/route.ts → POST /api/uploads/sign。参加者向け署名。B、active/visible roomとvisible post。入力postId、pathはDB。S、最小署名API。P2、RLS迂回口と署名TTL/削除整合確認。
- app/api/storage/sign/route.ts → POST /api/storage/sign。公開作品署名。公開、visible post/visible published room/path一致。入力postId。S、公開仕様を維持しprivate bucket署名だけ限定。P2、rate制限と公開ログ範囲。
- app/api/uploads/public/[postId]/route.ts → GET /api/uploads/public/[postId]。上記へ委譲しredirect、間接Service Role。公開、同一可視判定。入力postId。S、署名をアクセスlog/分析に残さない。
- app/api/rooms/create/route.ts → POST /api/rooms/create。room/creator membership作成。B、creatorを認証UIDに固定。入力room設定。S/N、複数insertを原子的RPCへ。P2、部分作成・容量制限。
- app/api/rooms/delete/route.ts → POST /api/rooms/delete。membership→room物理削除。B、created_by/host_ids/旧hostのOR。入力roomId。S、削除仕様/role体系レビューが必要。P2、旧host退出・非原子・FK/Storage orphan。
- app/api/rooms/join/route.ts → POST /api/rooms/join。supporter upsert。B、visible open確認のみ。入力roomId。X。P1、同意/枠なし、creator/core降格・is_core残存、退出制限迂回。UI参照残り今回は保持。
- app/api/rooms/join-supporter/route.ts → POST /api/rooms/join-supporter。supporter参加。B、visible open/同意非空/45枠、active既存role維持。入力roomId/同意version時刻。N/S、原子的参加RPC。P2、count競合と同意証跡のclient依存。
- app/api/rooms/request-core/route.ts → POST /api/rooms/request-core。core申請。B、visible open/approval有効/同意。入力roomId/同意。N、本人INSERT RLSと原子的重複防止。P2、申請raceとserver同意記録。
- app/api/rooms/join-core-first-come/route.ts → POST同名。参加RPC、続いて同意更新。B、同意、actorは本人。入力roomId/同意。S、RPC公開EXECUTE/本文を先に監査。P1要調査、APIを経ずRPC可のため本文に依存。Nへ単純置換不可。
- app/api/rooms/join-core-by-invite/route.ts → POST同名。招待参加RPC+同意。B、code必須、actor本人。入力roomId/code/同意。S、招待照合/人数/activeはRPC確認待ち。P1要調査、codeログ禁止・rate制限。
- app/api/rooms/approve-core/route.ts → POST同名。申請確認→RPC→同意転記。B、対象room確認、actor本人、creator認可はRPC依存。入力roomId/requestId。S、原子性/実RPC認可を確認。P1要調査。
- app/api/rooms/reject-core/route.ts → POST同名。拒否RPC。B、actor本人、最終認可RPC。入力roomId/requestId。S、公開実行権と本文の監査。P1要調査、未認可成功を確認したわけではない。
- app/api/rooms/leave/route.ts → POST /api/rooms/leave。left_at更新。B、active、creator不可、core時間制限。入力roomId。N/S、退室RPCで投稿/権限変更と整合。P1旧joinとの組合せ、単独認証は機能する。
- app/rooms/[id]/core-approve/route.ts → POST /rooms/[id]/core-approve。request承認→core insert。C、room owner、対象request一致。入力roomId/requestId。X、P1枠/同意/状態不足、部分成功。通常本人RLSでは他人権限を操作できず、統合RPCが必要。
- app/rooms/[id]/core-reject/route.ts → POST /rooms/[id]/core-reject。request拒否。C、owner/request room一致。入力roomId/requestId。X、同一認可の現行RPCへ統合候補、P2旧UI/状態整合。
- app/rooms/[id]/core-revoke/route.ts → POST /rooms/[id]/core-revoke。request revoked→core membership物理削除。C、owner/対象room/approved確認。入力roomId/requestId。X、P2非原子/履歴消失、退出・投稿整合を設計して統合。
- app/api/rooms/[id]/invite-code/route.ts → GET /api/rooms/[id]/invite-code。招待コード取得。B、created_by本人。入力roomId。S、secret列の狭いAPI。P1、DB全列SELECTが別経路で漏らすためAPIだけでは保護不可。
- app/api/rooms/seen/route.ts → POST /api/rooms/seen。本人active last_seen_at更新。B、UID固定/active。入力roomId。N、限定列RLSで代替候補だが現在UPDATE grantなし。P2、ブラウザ直書きとの二重経路整理。
- app/api/rooms/mark-read/route.ts → POST /api/rooms/mark-read。本人last_read_at更新、退出除外なし。B、UID固定。入力roomId。X、P2実DBに列なし、seenへ統合候補。
- app/api/rooms/unread-map/route.ts → GET /api/rooms/unread-map。本人active roomの未読集計。B、UID固定。入力excludeSelf。N、可視RLS/最小集計で代替。P2、hidden/deleted投稿が集計に入るコード差。
- app/api/rooms/like/route.ts → POST /api/rooms/like。本人like toggle。B、UID固定、room可視性なし。入力roomId。N、本人like RLS候補。P2、対象可視性/削除error/競合確認。
- app/api/reports/create/route.ts → POST /api/reports/create。通報作成。B、reporter本人、種別/理由必須。入力targetType/targetId/reason。N、本人INSERT RLS候補。P2、対象アクセスとspam制限・運営処理が必要。
- app/profile/set-username/route.ts → POST /profile/set-username。本人profile/表示名同期。B、UID固定、名前検証。入力username。N/S、本人更新はRLS、他表同期は狭い処理。P2、複数表整合。
- app/profile/set-bio/route.ts → POST /profile/set-bio。本人bio同期。B、UID固定。入力bio。N、本人列更新と同期の整理。P2、公開プロフィールとPP整合。
- app/profile/set-sns-links/route.ts → POST /profile/set-sns-links。本人SNS同期。B、UID固定、許可項目。入力SNS各URL。N、本人列RLS。P2、公開識別子/リンク安全性の継続確認。
- app/api/update/route.ts → POST /api/update。旧username更新。B、本人固定。入力username。X/N、P2検証長/同期先が現行と異なる。caller確認後統合。
- app/api/account/delete/route.ts → POST /api/account/delete。profiles匿名化→Auth delete。B、本人だけ。入力のuserIdではなくsession UID。S、Auth admin操作は管理権限が必要。P2、実DBにないprofiles列/条件、FK NO ACTION、非原子。削除仕様承認前に手を入れない。
- app/api/cron/publish/route.ts → GET /api/cron/publish。期限公開UPDATE。認証query key==CRON_SECRET、通常ユーザー不要。入力key、対象はserver時刻条件。S、管理job。P2、Vercel headerとの不一致・URL秘密・debug応答。scheduler移行案を別承認。

## 今回Service Role経路を除去

- app/api/rooms/expire/route.ts → POST /api/rooms/expire。以前は無認証DB更新/P1。現在410、認証/入力を問わずDB無アクセス。用途は認証cronへ集約すべき。
- app/api/debug/buckets/route.ts → GET /api/debug/buckets。以前は無認証Storage設定列挙/P2。現在410、Storage無アクセス。公開用途なし。
- app/rooms/join/route.ts → POST /rooms/join。以前はBのみで同意/枠迂回/P1。現在410、入力を消費しない。現行join-supporterへ手動UI移行。
- app/api/rooms/expire/join/route.ts → POST同名。以前はB、open/旧countのみ、is_core自動付与/P1。現在410。role default/Triggerで実coreになるかは未確認のまま廃止。

## API以外と共有モジュール

- app/rooms/[id]/page.tsx：SSR。publicアクセスもあり、adminでroom取得後hidden/deletedを除外、sessionで参加/creatorを評価。入力route roomId。N/S、read DTOを分離。P2、招待コード列の不要取得を減らす（現在clientへ渡してはいない）。
- lib/rooms/getUnreadMapForUser.ts：Cから本人active membership集計。入力excludeSelf。N、適切なSELECT RLSで代替。P2、APIと違いposts hidden/deletedは除くが親roomは除かない。
- app/api/rooms/_shared.ts：Bearer requireApiUser、consent parse、admin fetchRoom。HTTP endpointでない。入力token/roomId/同意。S/N、callerが認可する必要、fetchRoom自体にhidden検査なし。共通化は認可を自動保証しない。
- lib/supabase/admin.ts：admin client factory/singleton。認証・認可はcaller責任。S、server-only境界とimport検査を検討。秘密値未出力。
- lib/supabase/server.ts：Cookie user clientとadmin factory。同様にcaller責任。S/N、役割を明確化しclient import禁止を検証。
- scripts/reset-password.mjs：ローカル管理CLI、userId/password引数でAuth管理更新。HTTP認証なし（ローカル管理権限前提）。S、任意他人変更を一般clientへ移さない。P2、引数履歴/プロセス露出、対話入力等の設計候補。値を読まず実行もしていない。

## 認可の共通結論

- UIが隠すだけではDBを保護できない。前回監査のPUBLIC/auth無条件SELECT、posts本人UPDATE全列、rooms INSERTの弱いORを合わせて修正する必要がある。
- 一方room_members.last_seen_atは必要なUI更新がGRANTで禁止。RLS policyの存在だけで実効権限ありとしない。
- authenticated client化はRLS/GRANTを整えた後。service role使用を一律除去すると既読/署名/管理処理を壊す。
- 6 RPCのSECURITY DEFINER/公開EXECUTEは要調査。実本文/Triggerの確認なしにAPI認可の安全性を主張しない。
- 本書はソース到達経路一覧。個別APIの全入力・悪用パターンを網羅したペネトレーションテストではない。監査時点の追加/削除はrgのパス一覧と照合し更新する。

## 旧API整理の追加更新（2026-10-21）

今回ユーザー承認により/api/rooms/joinと/rooms/[id]/core-request・core-approve・core-reject・core-revokeをローカル410化。JoinButton/OwnerCoreRequestsPanelを除去し現行RoomDetailClientにUIを一本化した。本文の「旧join/旧coreは保持・未解決」はこの変更前の状態を示す。最新詳細はLEGACY_JOIN_CORE_RETIREMENT.mdとAI_HANDOFF第29節。DB直接DML/RPC/添付所有権は未修正、本番未適用。
## Web MVP差分（2026-10-21）

新規添付台帳/RPCとrate limitはservice専用で、actorをgetUser結果から渡す。posts/create、uploads、room create/join/core/like、reports/createから使用する。flag false時は添付を閉じ、本文とその他操作は従来経路。通常clientへの移行は実RLSが未整備のため今回行わない。
cronはquery secret/debugを廃止しBearer必須・hidden/deleted除外・再実行0件へ。likeはroom可視性確認と削除失敗の成功誤表示を修正。rooms join/core系の未分類DB例外は汎用応答へ。
MarkRoomSeenOnViewは直接UPDATEから既存seen APIへ。これはservice role拡大による新権限ではなく既存の本人active membership確認経路に統一したもの。
旧API停止の記録を保持。既存RPC内部、account deletion、未読集計、直接DB迂回は残課題。WEB_MVP_IMPLEMENTATION.md参照。

## 第41節・最新走査
全44route/直接privileged参照30/無作用410分類11、Supabase参照70ファイルを再走査。final-route-inventory.jsonとfinal-supabase-clients.jsonに列挙。今回の最新用途・認可と残P1はFINAL_SECURITY_PASS.mdが正本。新013〜017はservice専用RPC、Auth/Storage workerの自動接続なし。旧本文の未実装記述を現時点と混同しない。
