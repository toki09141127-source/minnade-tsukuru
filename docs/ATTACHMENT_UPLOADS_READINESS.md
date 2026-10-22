# attachment_uploads 実装前提の再評価
2026-10-21。設計案のみ。DDL/migrationファイル作成・適用なし。

## 結論
台帳方式は必要だが、新テーブルを追加するだけでは不十分。postsの直接INSERT/UPDATEが添付所有権やルーム状態を保証しない実RLSを確認したため、全投稿書き込み経路を同じ原子的な認可へ集約することを導入条件とする。
今回の58ケースの添付モックは同一room他ユーザーpathの受理を再現している。既存pathの所有者を後付けで推定しない。

## 実DBとの対応
- 同日の既存カタログではpublic/auth/storageにattachment_uploads/post_attachmentsはない。その他スキーマや新しい変更まで不存在を保証しない。実装直前に再確認する。
- posts.id/room_id/user_id、rooms.idはuuid。posts.user_idはNOT NULLだがauth.usersへのFKはない。
- posts.room_id→rooms.idはON DELETE CASCADE。room_membersもroom_id/user_idがCASCADE。room_members(room_id,user_id)はUNIQUE。
- rooms.created_by、room_members.approved_by、room_join_requests.decided_by等はAuth削除を妨げ得るNO ACTION。
- ルーム削除APIは物理削除。新しいRESTRICT FKを単純追加すると既存操作を壊す。Auth削除も別の仕様判断が必要。
- room_uploadsはprivate。Storageの5ポリシーの条件全体・管理者アップロード時のowner属性は未確認。Storage ownerをアップロード本人の証明として扱わない。
- publicの既定GRANTは広い。新規テーブル/関数作成と同一トランザクションで実効権限を閉じる必要がある。
- 既存公開作品はposts.attachment_urlにStorage pathを保存。postIdから可視投稿/公開roomを確認し5分署名する互換経路がある。finalだけでなくログの添付も維持する。

## 台帳の論理スキーマ案
- id UUID：推測困難なupload ID。識別子の秘匿だけを認可にしない。
- owner_user_id UUID nullable：auth.users.idへON DELETE SET NULL案。NULLは新規紐付け不可。
- room_id UUID nullable：rooms.idへON DELETE SET NULL案。NULLは新規紐付け不可。
- bucket固定識別子、object_path：サーバー生成、(bucket,object_path) UNIQUE。クライアントから任意指定させない。
- state：reserved / uploaded / bound / cleanup_pending / deleted / failed。期限、created_at、uploaded_at、bound_at、cleanup_claimed_at、deleted_atを保持。
- post_id UUID nullable：posts.idへON DELETE SET NULL案。1投稿1添付を現仕様に合わせUNIQUEな非NULL post_idで保証。複数添付対応は別設計。
- verified MIME/size、storage検証情報、server-generated upload request key、投稿idempotency key。
- bound_atは一度設定したら解除しない。post_idがFKでNULLになっても未使用へ戻さず、再使用を防ぐ。
- owner/room/postのSET NULL後もpathと状態を残し、Storage削除対象を追跡できる。物理CASCADEで台帳を消して孤児ファイルを作らない。
- bound状態でpost_idがNULLになる遷移をFK削除が起こすため、単純なCHECK「boundならpost_id NOT NULL」は置かない。削除済み紐付けとcleanup待ちを区別する状態不変条件を設計する。
- 生のファイル名や不要なプロフィール情報は台帳へ保存しない。サーバー検証した型/サイズだけにする。

具体的FK/UNIQUE/CHECK/default/indexのDDLは既存Trigger/削除方針確認後。現存postsに新しい非NULL列を直ちに要求しない。

## uploadから投稿まで
1. APIでBearerを検証しactorを確定。可視・未削除open roomとactive membershipを確認。
2. サーバーがupload IDと一意pathを生成しreserved行を作る。room/ownerは認証結果と検証済みroomから設定。
3. Storageへupsert=falseでアップロード。パス例はrooms/{roomId}/{type}/{uploadId}.{ext}とし、既存pathバリデータと互換を保つ。拡張子/MIMEを信用せずバイト内容の検証方針も用意。
4. 成功応答またはサーバー側再確認後、台帳をuploadedへ。通信失敗で結果不明なら同じpathを調べるサーバー側リトライに留め、クライアント申告だけでuploadedへしない。
5. クライアントはpost作成時にuploadIdとidempotency keyを送る。任意attachment_urlを新規投稿の所有権証明として受理しない。
6. DBの1トランザクション内でroom、membership、台帳を固定順にロック。可視open、active、finalならcreator/core、owner=actor、room一致、uploaded、期限内、未紐付けを再検証。
7. posts INSERTと台帳bound/post_id/bound_at更新を同一トランザクションで確定する。path/MIMEは台帳から採用。途中失敗は両方ROLLBACK。
8. (actor,idempotency_key)を一意管理し、レスポンス消失後の同じリクエストは同じpostを返す。payload相違なら拒否。別keyで同じuploadの二重消費は拒否。
9. 添付なし投稿も同じroom/role検査を通す。旧create経路や直接RESTによる迂回口を残さない。

StorageとPostgresは1つのACIDトランザクションにできない。原子的にできるのはposts作成＋台帳消費であり、アップロード自体は状態遷移と補償cleanupで扱う。
room公開/退出と投稿確定の競合を防ぐには、公開・退出側も同じロック順/トランザクション境界へ合わせる必要がある。新RPCだけがロックして他経路が別表を自由更新する状態では十分でない。

## RPC権限設計案
推奨はAPI専用の投稿確定RPC。service_roleだけEXECUTE可能とし、PUBLIC/anon/authenticatedへの既定EXECUTEを同時に除去する。
- APIで検証したactor UUIDを渡す。client bodyのuserIdは無視する。
- SECURITY INVOKERを基本とし、Service RoleのDB権限で実行。特権昇格が不要ならSECURITY DEFINERを追加しない。
- search_path固定、スキーマ修飾、動的SQLを避ける。認可、ロック、件数検査、上限、idempotencyをRPC内でも実装。
- API専用引数actorを任意ユーザーが直接指定できるEXECUTE権限は与えない。
- 将来authenticated直接呼び出しへ変更するならauth.uid()をactorとして内部取得し、引数偽装を不可能にする別設計としてレビューする。
- 既存参加RPC群は別にEXECUTE公開/内部認可の審査が必要。本RPCの安全性を既存RPCの名前やフラグから類推しない。

## RLS/GRANT方針
- 新台帳はRLS有効、anon/authenticatedへのテーブルDML/全列SELECTなし。本人向け状態確認が必要ならAPIで最小DTOを返す。
- service_roleのバイパスを前提に、API/RPC内のowner/room/active/可視条件を明示する。
- postsの直接INSERT/UPDATE、特にattachment_url/post_type/room_idを変更する権限を閉じ、旧API・RLS・GRANTを含めて台帳の利用を強制する。列REVOKEだけで全テーブルUPDATE許可は消えない。
- SELECTは公開作品/参加者の修正案に合わせる。room_members全列UPDATEを付与しない。既読はseen経路へ整理する案。
- Storageへの直接INSERT/UPDATE/DELETEや署名取得が台帳を迂回しないよう、room_uploadsの実ポリシー確認と制限を同時に行う。privateだけでは保証できない。
- 関係のないテーブルや全RPCの権限を一括で閉じない。

## 削除・owner削除・cleanup
- 投稿論理削除：直ちに新規署名を拒否。台帳をboundのまま保持し、既存署名URLの期限切れまでの最大TTLを考慮する。復元/保持期間を決めてからStorage削除を予約する。
- 投稿物理削除：post_id SET NULLでもbound_atを残し、未使用として再消費しない。残った台帳をcleanup対象として識別できるようにする。
- room物理削除：room_id SET NULL後も台帳pathを保持。既存posts CASCADEとの順序をテストする。台帳をCASCADE削除してはならない。room削除処理とcleanup起票の原子性を設計する。
- owner削除：owner_user_id SET NULL。公開済み作品の添付を自動削除しない。未使用uploadsは保持期限後cleanup、bound uploadsは作品保持方針に従う。既存Auth FKや退会仕様は変更せず別承認。
- cleanup：初期案として未使用reserved/uploaded/failedを24時間以上経過後候補とする（値は運用承認待ち）。アップロード中の猶予・再試行期間を別に持つ。
- workerは台帳行をロックしcleanup_pendingへclaim、post作成も同じ行ロックで競合排除する。claim後は新規bind不可。DBトランザクションを閉じてStorage APIで削除し、成功/不存在確認後deletedへ。
- Storage削除はバケット＋完全一致path、サーバー管理prefixのみ。失敗は再試行し、台帳を先に消さない。Storageテーブルを直接DELETEしない。
- 台帳なしの旧objectやbound objectは通常orphan cleanup対象外。pathが見えることを「捨ててよい」の根拠にしない。
- 一度Storageを消した後のROLLBACKは復元手段にならない。保持・バックアップ・削除承認と復旧手順を先に準備する。

## 既存公開作品と移行順序
1. 追加定義レビュー、同一path再使用の扱い、削除/保持期間、旧APIの終了方針を確定。現状ではUSER APPROVAL REQUIRED。
2. ステージングに合成fixtureを用意し、台帳/RPC/RLS/Storage境界と競合・削除・復帰をテスト。今回migrationファイルは追加しない。
3. 新テーブル/RPCを制限済み権限と同一トランザクションで導入する案。API切替まで新規台帳は外部公開しない。
4. 新アップロード→台帳→原子的post作成へ切替。旧クライアントは再アップロード要求または安全な機能停止とし、旧path任意受理へのフォールバックは作らない。
5. posts/Storage直接書き込みと旧APIを同時に閉じる。混在期間に穴が残るなら短い新規投稿・アップロード停止を計画する。
6. 既存投稿の添付読み取りはpostId起点の可視性/公開状態判定で維持。既存公開ログも対象。新台帳に存在しない旧pathを新投稿へ流用させない。
7. 旧添付の台帳移行が必要なら所有者が証明できたものだけ別プロセスで行う。既存投稿者=アップロード所有者と仮定しない。重複pathは1回利用UNIQUEへ無理に押し込まない。
8. 安定後にcleanupのdry-run集計、限定範囲、段階有効化。実データ調査/削除は別承認。

## rollback案
- DDLトランザクション途中の失敗はROLLBACK。コミット後は新規upload/post機能を停止し、既存作品のread-only経路を維持する。
- consumed台帳・idempotency記録は保持し、旧の任意path受理へ戻さない。
- カラム/テーブルをDROPして証跡を失わない。安全な互換APIまたは前進修正で復旧する。
- Storage削除前ならcleanup停止で保全できる。削除後はDB rollbackでは戻らないため、事前に定めたバックアップ/保持からの復元が必要。

## 実装開始の合格条件
- 通常JWTの直接REST/RPCでも台帳なし・他人upload・別room・再使用を拒否。
- 同時post、二重submit、response lost、cleanupとの競合で二重紐付けや既存添付消失がない。
- final role、active member、room公開/削除競合、owner削除、room/post削除とFKが整合。
- 旧公開作品/ログ/添付閲覧が維持され、新規投稿に旧path流用不可。
- mockだけでなく実Postgres/Storageのステージングで権限・制約・トランザクションを検証。


## 追加設計：実装用フィールド契約（2026-10-21、案）

以下を次回実装の推奨契約とする。法務・削除期間とDB追加定義の承認が前提。前節のowner_user_id/object_path/state/bound_atは論理名であり、実装候補名はそれぞれuser_id/storage_path/status/used_atに統一する。同じ意味の列を二重に作らない。

- id: uuid PRIMARY KEY、サーバー生成。変更不可。
- user_id: uuid NULL、auth.users(id) REFERENCES ON DELETE SET NULL。予約時は必須、NULLなら確定不可。所有者変更不可。
- room_id: uuid NULL、rooms(id) REFERENCES ON DELETE SET NULL。予約時必須、NULLなら確定不可。別roomへの移動不可。
- bucket: text NOT NULL、初期値room_uploads、CHECK固定値。
- storage_path: text NOT NULL、サーバー生成、UNIQUE(bucket,storage_path)。上書き不可。物理Storage行へのFKは置かない。
- status: text NOT NULL、CHECK reserved/uploaded/bound/cleanup_pending/deleted/failed。初期reserved。
- created_at: timestamptz NOT NULL、DB時刻。
- uploaded_at: timestamptz NULL、サーバー検証完了時刻。
- used_at: timestamptz NULL、投稿確定時刻。一度設定したら不可逆。
- expires_at: timestamptz NOT NULL、予約時にサーバーが設定。仮24時間。used_atありは期限で通常orphan削除しない。
- post_id: uuid NULL、posts(id) REFERENCES ON DELETE SET NULL、非NULL値UNIQUE（一投稿一添付）。
- mime_type: text NULL、検証済みMIMEのみ。uploaded/boundへ進むには必須。
- size_bytes: bigint NULL、CHECK非負。uploaded/boundへ進むには必須。アップロードAPIの種別別上限も検証。
- cleanup_claimed_at / deleted_at: timestamptz NULL。cleanup_attempts integer NOT NULL DEFAULT 0、CHECK非負。
- failure_code: text NULL、列挙した内部コードのみ。例外全文・URL署名・ユーザー本文は記録しない。
- object_fingerprint: text NULL、必要なら検証用ETag等。ハッシュで権利者を証明できるとは扱わない。

制約案：uploadedならuploaded_at/MIME/sizeありかつused_atなし、boundならuploaded_at/used_atあり、post_idがあるならused_atあり。boundでもFK削除でpost_id=NULLは許す。user_id/room_idのNULL化とbound履歴は許す。通常CHECKだけでは「過去に使用したことがない」や状態の逆戻りを防げないため、変更可能な経路を専用RPCに限定し状態遷移を検証する。新規予約時のuser_id/room_id非NULLはRPCで強制。期限はCHECKでnow()比較せず確定RPCで検証する。

index候補：user_id+created_at（本人照会）、room_id、post_idのUNIQUE、status+expires_at WHERE used_at IS NULL（cleanup）。同時に不要indexを増やさない。

別テーブル候補 post_requests：actor_id UUID、request_key UUID、payload_digest text、post_id UUID nullable、created_at。UNIQUE(actor_id,request_key)。actor消失後の保持方針を承認するまでは具体的Auth FKを確定しない。投稿削除後の同key再送は「削除済み」で終え、再作成しない。request_keyは認可の代用にしない。

### 確定RPCの入出力と失敗契約

入力は検証済みactor_id、room_id、post_type、content、upload_id nullable、request_key。APIはbody.user_idを無視。出力はpost_idとreplayedだけ。添付path/署名URLをクライアント入力で受理しない。
処理順はrequest_keyを同時挿入で予約→room行→active membership行→upload行をロック→全条件再検証→posts挿入→台帳使用→request結果保存。同じkeyの同時呼び出しはUNIQUE競合解決後に同payloadの結果を返す。異なるpayloadは409。失敗で予約だけ残さない。複数roomを扱う将来処理ではroom UUID順にロック。

- 401: 無効session（APIで拒否）。403/404: 参加・可視性・権限違反。409: 使用済み/cleanup中/期限切れ/同key異payload。413/415: size/MIME不可。503:一時障害。DB内部例外はクライアントへそのまま返さない。
- 残った予約＋Storage成功応答消失は同pathのmetadata確認で回復。クライアントの「upload完了」だけでは不可。検証中objectを署名公開しない。
- MIME申告と実bytesの不一致、圧縮爆弾、SVG/HTML等の能動コンテンツは許可list/配信Content-Disposition/別originを検討。EXIF除去の前後でハッシュ・サイズを確定。現状未実装。
- cleanup削除とupload完了が競合しないよう、upload開始/検証leaseを持つ。長時間uploadを期限だけで削除しない。worker crash後lease期限で再claim。削除成功後のDB書込失敗は再削除の不存在を成功扱いし追認。

### 実装チケットと検収

A. RPC/Trigger/CHECK/Storage実定義の追加監査（承認待ち）。B. 合成DB fixtureで台帳・post_requests・権限・状態遷移。C. API upload予約/確認。D. 投稿確定RPCと旧入力拒否。E. read互換。F. dry-run cleanup。G. ステージング競合/E2E。H. 移行手順承認後だけ本番。
必須検収は同uploadを異keyで同時消費、同key応答消失、期限境界、退室/公開との競合、owner/room/post物理削除、used_at保持、Storage成功後DB障害、cleanup claim後bind拒否、旧作品署名継続、直接REST/RPC拒否。モックのみで移行承認にしない。

USER APPROVAL REQUIRED：公開後の作者削除と作品維持、法的削除例外、未使用TTL/使用済み保持期間、旧client切替停止時間、既存RPC/Triggerとの整合、上記DB設計・適用。本節はレビュー可能な実装契約までで、適用可能性が実DBで最終確認済みという意味ではない。
## Web MVPローカル実装への更新（2026-10-21）

以前の「案のみ」から、supabase/migrations/202610210001_attachment_ledger.sql とupload/post APIのローカル実装へ進めた。本番には適用していない。差分の正本と移行順序はWEB_MVP_IMPLEMENTATION.md。
requestの本文はSHA256のみ、lock順序はactor advisory→room→membership→upload。cleanup lease/worker/EXIFは未実装。旧案の全項目が実装済みという意味ではない。
53件のPGlite合成検証は成功。実DB/RPC/Storage監査、複数接続staging、削除保持方針が公開の前提。USER APPROVAL REQUIRED。
