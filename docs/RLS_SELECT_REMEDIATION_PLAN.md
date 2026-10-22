# 無条件SELECTを解消する修正案

作成日：2026-10-21。状態：設計案。コード・DB・migrationへの適用なし。
根拠：AI_HANDOFF.md第18～20節、監査CSV2件、現在のリポジトリの読み取り経路。

## 1. 推奨する修正

3テーブルのSELECTポリシーを、次の明示的な閲覧範囲へ置き換える。ルームの公開情報は維持し、未公開投稿と他人の参加情報を絞る。併せて公開列とビューを制限する。

- rooms：is_hidden=false、deleted_at IS NULLのルームの公開列だけをanon/authenticatedに許可する。ルーム一覧とランキングの現状に合わせ、openだけに限定しない。
- posts：投稿自身と親ルームがともに非表示でなく、削除されていないことを必須とする。そのうえで、親ルームがforced_publishなら公開、そうでなければ認証済みの参加中メンバーだけに許可する。
- room_members：authenticatedに自分の行だけを許可し、anonには許可しない。本人の退出済み行も残す。参加人数や必要な参加者表示は別の限定された読み取り口で提供する。
- rooms.core_invite_codeなど非公開列は、行RLSだけでは保護できない。テーブル全列SELECT権限を見直し、公開列への列単位SELECTと限定ビュー/APIへ移す。

これは推奨する製品上の境界であり、未公開掲示板の非参加者・退出者からの閲覧を制限する動作変更を含む。現状の無条件SELECTが保証していたアクセスを互換要件として残さない。実装着手時にこの境界を確認する。

## 2. 確認済みの問題と限界

監査時点で、以下はすべてPERMISSIVE SELECTかつUSING trueだった。

- PUBLIC：posts_select_all、rooms_select_all、room_members_select_all。
- authenticated：posts_select_authenticated、rooms_select_authenticated、room_members_select_authenticated。

3テーブルにはanon/authenticatedのSELECT権限があり、RESTRICTIVEポリシーはなかった。他のPERMISSIVEポリシーを狭くしても、無条件許可がORで結合されるため制限にならない。

6件の削除だけで完了とはしない。posts_select、posts_select_visible、posts_select_room_members、room_membersの既存本人/所有者向けポリシー等も、全文と適用ロールを未確認である。SELECTおよびALLに適用される全ポリシーを調べ、最終的な許可の和集合が上記境界以内になることを確認する。

ユーザー行やRESTからの実データ取得は行っていない。漏えいの発生・過去のアクセスは未調査。本案は設定上の過大な閲覧許可への対処である。

## 3. コードとの対応

### 公開作品

app/works/[id]/page.tsxはforced_publishのルームについて、final投稿とlog/NULL種別の制作ログを両方表示する。公開ポリシーをfinal限定にすると既存表示を壊すため、少なくともこれらを維持する。推奨条件は公開ルーム内の可視・未削除投稿を許可するものとし、別の非公開post_typeが存在する場合は実装前に対象を限定し直す。

作品ページは公開クライアントから取得するため、匿名での読み取りを実際に検証する。ログイン時だけ通るテストでは不十分。

### ルーム一覧と詳細

app/rooms/RoomsListClient.tsxとapp/works/WorksListClient.tsxはrooms_with_counts_v2を使用する。前者は可視・未削除、後者はさらにforced_publishを条件にする。app/rankings/page.tsxはroomsを直接読む。列権限とビューを同時に整合させる。

app/rooms/[id]/page.tsxはService Roleでroomsを読むため、RLS変更の保護対象外。非表示・削除のサーバー側チェックを維持する。同ファイルはcore_invite_codeを取得するが、RoomDetailClientへはid/status/招待設定フラグだけを渡しており、今回確認した箇所で招待コードをそのままクライアントpropsへ渡してはいない。不要な招待コード取得は実装時に削除する。

招待コードは既存app/api/rooms/[id]/invite-code/route.tsで認証とcreated_by照合後に返している。この専用経路を維持し、非表示・削除ルームでの扱いも境界に合わせて確認する。ブラウザーにService Roleを渡して解決しない。

### 本人の参加状態と掲示板

RoomDetailClient.tsxはroom_membersから本人のrole/joined_at/left_atを取得する。本人SELECT条件にleft_at IS NULLを加えると退出状態の判定を変えてしまう。一方、投稿閲覧の参加資格判定にはleft_at IS NULLを必須とする。

BoardClient.tsxの投稿一覧はdeleted_atを除外するがis_hiddenをクエリで除外していない。非表示投稿の排除はDBでも必須。UI側にも同じフィルターと権限エラー表示を加え、空結果と通信失敗を区別する案とする。

creatorのroom_join_requests閲覧は別テーブルの依存事項であり、本案の3テーブル変更で安全になったとは扱わない。参加者一覧が必要な画面は、利用目的に必要な表示名・役割等だけのDTOを設計し、同意情報や既読時刻を全員分公開しない。

## 4. 最終ポリシーの論理条件

以下はレビュー用の論理式であり、実行可能なmigrationではない。

visible_room(r) := r.is_hidden = false AND r.deleted_at IS NULL
visible_post(p) := p.is_hidden = false AND p.deleted_at IS NULL
self_member(m) := authenticated AND m.user_id = auth.uid()
active_member(r) := self_member(m) AND m.room_id = r.id AND m.left_at IS NULL の行が存在

rooms SELECT := visible_room(r)
room_members SELECT := self_member(m)
posts SELECT := visible_post(p) AND 親roomsが存在 AND visible_room(r)
                AND (r.status = 'forced_publish' OR active_member(r))

- 匿名のactive_memberは常に偽とする。投稿者本人であることだけでは、非表示・削除済み投稿や非公開ルームへの例外を付けない。
- creator/core/supporterを参加中メンバーとして扱う。rooms.created_byだけで参加状態に関係なく閲覧する特例は作らない。creatorの所属行が欠けるケースがあれば、既存データ整合性と仕様を別途確認する。
- closedの投稿は参加中メンバーのみ。forced_publishになるまで匿名公開しない。退出者は公開作品のみ閲覧できる。
- room_membersの本人判定はrooms/postsを参照しない。roomsもroom_membersを参照しない。postsからroomsと本人membershipを参照する一方向にし、RLSの相互参照・無限再帰を避ける。
- 補助関数を導入する場合はSECURITY DEFINERを安易に使わず、必要性、引数偽装対策、固定search_path、EXECUTE権限を別途審査する。
- INSERT/UPDATE/DELETE用ポリシーは無条件に削除しない。ALLポリシーを置換するときは、DML側の現行条件を個別に維持・レビューする。UPDATEにはSELECT可視性も影響するので回帰試験を必須にする。

## 5. 列権限とビュー

### roomsの公開列

公開列の候補はid/title/work_type/status/created_at/expires_at/time_limit_hours/like_count/is_adult/is_hidden/deleted_at/concept/ended_at/enable_core_approval/enable_core_invite/category/ai_level。実DBに存在し、読み取り経路で必要なものだけを採用する。typeやmember_countは既存ビューの投影・集計列として定義を確認する。core_invite_codeは含めない。created_by等の追加公開は用途を明示して判断する。

テーブル単位SELECTが残ったまま列単位GRANTを追加しても制限にならない。PUBLIC、anon、authenticated、継承ロールの実効権限をすべて点検し、全列SELECTを除去した状態で公開列へのGRANTを組む。DML権限の一括REVOKEは行わない。SELECT *に依存する呼び出しは明示列へ変える。

postsのuser_id/username/attachment_urlや、room_members本人行の同意関連列も、現在取得する列と公開目的を確認する。RLSで見える行に含まれる全列を公開してよいとは限らない。添付URLに直接公開URLや既存署名付きURLが保存されている場合、行ポリシーだけで失効できない。

### rooms_with_counts / rooms_with_counts_v2

これらはpostgres所有のビューで、security_invokerと本文が未確認。所有者権限で評価されるビューは基底テーブルのRLSを迂回し得る。ビュー側のフィルター・公開列・GRANT・依存ビューを確認し、旧経路も含めて境界を保証する。

推奨構成は、ルームの公開列と参加人数だけを返す読み取りAPIへ一覧を移行し、既存ビューへのクライアントアクセスを閉じるもの。APIは可視・未削除のルームだけを対象に、仕様で決めた参加人数（例：left_at IS NULL）を集計して返す。Service Role使用時はこの境界をサーバーで強制する。API化はコード変更を伴うため、今回は案のみ。

security_invoker=trueへ切り替えるだけでは、room_membersの本人限定RLSにより人数が本人分のみ/匿名0になる可能性がある。正しい集計との両立を確認せず切り替えない。API化までの互換ビューが必要なら、公開列・行条件・集計だけに限定した定義を別途レビューし、汎用のメンバー行参照を公開しない。

profiles_publicやreport_counts、RPCを含む他経路が対象テーブルを読んでいないかも確認する。不要な旧ビューのSELECT許可を残さない。

## 6. 適用前に必要な追加確認

1. 3テーブルの全SELECT/ALLポリシーのUSING/WITH CHECK、適用ロール、PERMISSIVE/RESTRICTIVEを取得し、保持・置換・削除を1件ずつ確定する。
2. 対象テーブル・列・ビューの実効GRANT、ロール継承、ビューの本文/security_invoker、依存関係、Postgresバージョンを確認する。
3. 投稿閲覧に使うroom_id、membershipのuser_id/room_id/left_at等の索引・制約を確認し、ステージングで実行計画を確認する。実ユーザー行の取得は不要。
4. SECURITY DEFINER RPC経由で所属を偽装してactive_member条件を満たせないかレビューする。既存監査の文字列フラグだけでは結論できない。Storageの別経路も別途審査する。
5. 公開ログの範囲、退出者の扱い、人数の定義、参加者表示の必要列を確定する。非公開の新しい投稿種別があるなら公開条件に反映する。

追加調査は読み取り専用SQLと取得対象を先に提示し、ユーザー承認後に実行する。関数・ビュー・ポリシー本文にはリテラルが含まれ得るため、未加工の本文をチャットや証跡へ一括出力しない。秘密情報を除外できるレビュー方法を準備する。この提案作成中に追加SQLは実行していない。

## 7. 実装と移行の順序（未実施）

1. 上記確認を終え、全ポリシーの最終一覧・公開列・ビュー/API仕様と具体的DDLをレビュー可能な形にする。
2. ステージングの合成データで実装。公開一覧APIとクライアントの明示列取得、エラー処理を準備する。既読処理の整理や退会修正は別タスクとし、一括で権限を閉じない。
3. ステージングで全経路の認可・機能試験を通し、互換性を確認する。新旧コードの混在期間も対象にする。
4. 本番適用は別途明示承認を得る。事前に依存するクライアントを移行し、DBのポリシー置換・列権限・旧ビューアクセス閉鎖を整合したトランザクションで行う。移行期間に過大許可が残るなら、その期間を短く計画するか対象機能を一時停止する。
5. 6件の無条件SELECTを除去し、その他のSELECT/ALL許可も最終仕様へ置換する。単に狭いPERMISSIVEを追加して完了としない。DMLポリシーは明示した差分だけにする。
6. 適用後はメタデータと承認済みの検証環境/テストアカウントで確認する。実ユーザー行を「安全性確認」のために一覧取得しない。

## 8. 合格条件と回帰試験（未実施）

合成データのあるステージングで、anon、非参加者、参加中creator/core/supporter、退出者、別ユーザーのJWTを用いて直接REST・ビュー・アプリAPIを確認する。SQL Editorのpostgres実行だけで合格としない。

- 可視ルームの公開列：匿名でも一覧・ランキング・詳細を閲覧できる。非表示/削除ルームは一般閲覧できない。
- 招待コード：直接テーブル/ビュー/REST、匿名ページやRSCレスポンスに含まれない。専用APIでは本人creatorだけに許可する。
- 未公開投稿：参加中のみ取得できる。非参加者・退出者は取得できず、投稿者本人でも例外にならない。
- 公開作品：匿名・参加者・退出者とも、可視・未削除のfinalとlog/NULL投稿を表示できる。
- 非表示/削除投稿、非表示/削除ルーム内投稿：公開状態や本人投稿に関係なく一般閲覧不可。
- room_members：自分の参加中/退出済み行だけ取得でき、他人の行や同意・既読情報を取得できない。匿名では行を返さない。
- 人数：同じ可視ルームの集計値が閲覧者のmembershipによって0/1に縮退しない。非公開情報を余分に返さない。
- 参加/再参加/退出、creatorの申請表示・承認、投稿作成・編集・削除、既読API、添付署名URL、公開作品添付を回帰確認する。Storage/RPCの独立した不備をRLS変更で解消したとは扱わない。
- 対象3テーブルのSELECT/ALL条件の和集合が設計境界以内であり、無条件許可・ビュー経由の抜け道・全列SELECTが残っていないことを検証する。
- RLS再帰エラー、権限エラー、想定外の空一覧、遅延を確認する。影響のない既存DML条件が変わっていないことを比較する。

## 9. 失敗時の扱い

適用トランザクション内で不整合が判明したらCOMMITせずROLLBACKする。COMMIT後の不具合は、事前検証した制限を維持する代替経路か前進修正で対処する。無条件USING trueや全列公開を自動復元しない。可用性を保てない場合は対象画面/APIを一時停止する手順を準備し、データ公開を復旧手段にしない。

現時点では完全な定義が不足しているため、コピペ実行用DDLは作らない。次に行う作業は、追加の読み取り専用監査SQLと安全な定義レビュー手順の作成・提示である。

## 10. 参照

- PostgreSQL：PERMISSIVEのOR結合、RESTRICTIVEのAND結合、RLS迂回ロール https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Supabase：RLSとGRANT、ビューのsecurity_invoker https://supabase.com/docs/guides/database/postgres/row-level-security
- ローカル証跡：AI_HANDOFF.md第18～20節、supabase-metadata-audit-2026-10-21.csv、supabase-followup-audit-2026-10-21.csv。

## 2026-10-21 追加監査による更新

承認済みSQL実行後、4ビューすべてsecurity_invoker=trueを確認した。本文の「未確認」は提案作成時点の記録であり、現状はSECURITY_AUDIT_2026-10-21.mdを優先する。ビュー所有者権限による迂回を実証したわけではない。
posts_select_visibleは投稿の可視・未削除条件だけ、他のmembership SELECTはleft_at条件なし。6件の無条件SELECTの削除だけでは不十分。
postsの本人UPDATEと全列権限、rooms_insert_authの認証のみ条件もAPIの制約を保証しないため、直接DMLの対策をSELECT修正と並行して設計する。
本人membershipに絞ると既存invokerビューの人数が縮むため、集計API移行案は引き続き必要。