# Migration acceptance（第51節）

001〜028全て開始時bytes不変・全台帳hash一致を再確認。追加SQLなし。本番適用なし。監査schema PG137と実staging合成14を再検証。既存全28本のレビュー内容を維持し、005再実行/019重複/023未知FK/025managed Trigger/物理削除の停止条件を再確認。[最終検収](RELEASE_FINAL_ACCEPTANCE.md)。

<details>
<summary>第50節以前の記録（現在の判定は上記を優先）</summary>

# Migration acceptance（第50節追加）

staging001〜028適用済み、本番未適用。001〜027開始時bytes不変、全28本を台帳hash照合済み。今回のSQL/テスト/実機限界は[最終検収](RELEASE_FINAL_ACCEPTANCE.md)。

028 `202610220028_release_consent.sql`:
- 前提001〜027。profilesへnullable adult_confirmed_at追加、本人だけSELECT。既存ユーザーへの同意捏造/backfillなし。
- 本人3引数mvp_accept_current_termsはauthenticatedのみ。anon/service/旧2引数は拒否。現在版2026-10-22と明示trueが必要。
- require_current_consentはprivate。create/join/Core request/approvalに現在の本人同意を要求し、旧申請を無断昇格させない。再申請で旧版を更新。既存guard/lock/ACL維持。
- local PG新18と実staging SDK14で検証。LF SHA256 be12b1e651531a5323fcee50ee53ccc7275bf8409fef80866cd04fe998619bb1。
- 適用後凍結。修正は029以降。互換app必須、旧同意RPCの再開/年齢backfillで戻さない。全一般書込APIへ年齢照合を追加したとの主張はしない。

<details>
<summary>第49節以前の記録（最新判断は上記を優先）</summary>

# Migration acceptance（第49節追加）

001〜026は開始時bytes/hashから不変。以下027を追加し、隔離stagingで成功を確認。現在の適用順は001→027、baselineは本番対象外。

- 027 `202610220027_deletion_pause.sql`: 前提001〜026。mvp_private control/checkpoints/effects、service-only checkpoint/effect wrapper、Owner-only pause/reconcile/operations、Auth pause guard、旧request/claim/prepare/advance直接EXECUTEをrevoke。
- 初期paused=true。permission expansionで一般clientへ公開しない。新private3表RLS有効、serviceのswitch実行不可、旧prepare直接不可をstagingで確認。
- SHA256（LF）: a64d6fe18c594047dc92bf4817e7cb12ba23f514311157555cfcd5585acf0131。
- ローカルPG119（うちpause16）、実staging pause29成功。Dashboard適用台帳28（baseline含む）。実行前editor全文比較必須。初回入力不整合は構文エラーで未適用、全文一致確認後に成功し、再適用していない。
- 適用条件: 古いworker drain、所有者権限、対象schema/Trigger照合。公開中の旧workerを残したまま切替しない。
- rollback: pauseを維持し互換appで前進修正。027 down/旧unsafe pathへ戻すことは禁止。Auth/Storageの物理削除は自動復元不可。

既存001〜026の詳細は下記の履歴を参照。027の内容は適用後凍結し、追加修正が必要なら028以降にする。


<details>
<summary>第48節以前の記録（最新判断は上記を優先）</summary>

# Migration最終マトリクス（第48節、2026-10-22）

正本: [本番手順](PRODUCTION_ROLLOUT_PLAN.md) / [判定](PRODUCTION_GO_NO_GO.md)。本番適用は未承認・未実行。

001〜026 **全26本が本番候補として必要**。既存本番の基礎schemaへ適用する連続した検収単位で、後続が一部関数を置換しても前段DDL/署名/データ契約を飛ばさない。staging専用baseline・guarded apply wrapper・verification schema・synthetic fixtureは含めない。008は最終workerの主経路ではないが、この検収済みchainから勝手に省略しない。

staging欄PASSは既存の適用記録26本＋最終結果の照合。今回再実行なし。本番「未適用」はこれまでの作業記録に基づき、今回の本番現況確認ではない。適用前に履歴・定義差を別承認で照合する。

## A. 依存・権限・構造（番号でBと対応）

| 番号 | 目的 | staging | 本番必要性 | 前提（番号順も必須） | App依存 | RLS/GRANT | FK | Trigger/RPC |
|---|---|---|---|---|---|---|---|---|
| 001 | 添付台帳・投稿原子性・rate | PASS | 必須・未適用記録 | 既存監査schema | upload/post | 台帳閉鎖、posts table/column DML剥奪 | owner/room/post SET NULL | create_post_with_upload、rate |
| 002 | Core4・kick・highlight | PASS | 必須・未適用記録 | 001 | membership/manage-member/mark | 専用service RPC | exclusions.room CASCADE | membership/core guards |
| 003 | 退会job・lease/CAS | PASS | 必須・未適用記録 | 001–002 | account worker（受付OFF） | job閉鎖、service RPC | Auth FKなし | request/claim/advance |
| 004 | 運営担当・非表示監査 | PASS | 必須・未適用記録 | 001–003 | moderation（OFF） | 運営表閉鎖、service RPC | 新規なし | mvp_moderate（010で置換） |
| 005 | 閲覧・列・DML/旧RPC境界 | PASS | 必須・未適用記録 | 002–004＋既存4view定義 | 新projection対応app必須 | restrictive RLS、DML/列縮小、public definer一括ACL | なし | read helper |
| 006 | draft・期限公開・log審査 | PASS | 必須・未適用記録 | 005 | draft/publication/cron/sign | client write閉鎖、公開read境界 | draft.room RESTRICT、review.post CASCADE | save/review/publish_due |
| 007 | 退会lease延長・解放 | PASS | 必須・未適用記録 | 003 | worker | service RPC | なし | renew/release |
| 008 | 保持snapshot基盤 | PASS | 必須・未適用記録 | 003,007 | 旧保持補助、現在は024主経路 | private保存、service RPC | snapshot.job RESTRICT | capture retention |
| 009 | 匿名名義・退会書込停止 | PASS | 必須・未適用記録 | 003,008 | account/author labels | job/名義表閉鎖、表示helper限定 | departed.job RESTRICT | write fence、request置換 |
| 010 | 運営is_hidden限定許可 | PASS | 必須・未適用記録 | 004,009 | moderation | capability全外部role閉鎖 | なし | guard・moderate置換 |
| 011 | 通報受領の永続化 | PASS | 必須・未適用記録 | 009,010 | report intake | receipt閉鎖、service RPC | Auth FKなし | 受領と旧INSERT例外分離 |
| 012 | 処理待ち通報一覧・対応監査 | PASS | 必須・未適用記録 | 004,010,011 | ReportQueue | resolutionsはservice直接も閉鎖 | resolution.receipt RESTRICT | list/resolve definer |
| 013 | 未使用upload cleanup | PASS | 必須・未適用記録 | 001,009 | uploadCleanup（自動scheduleなし） | service cleanup RPC | なし | claim/finish cleanup |
| 014 | like希望状態・冪等性 | PASS | 必須・未適用記録 | 003,009 | like flag必須 | 旧client DML剥奪、service RPC | 既存参照維持 | set_room_like |
| 015 | room＋Creator原子作成 | PASS | 必須・未適用記録 | 003,009 | room create flag必須 | requests閉鎖、service RPC | request.room RESTRICT | create_room |
| 016 | 運営・退会rate | PASS | 必須・未適用記録 | 001,004,015 | DB_GUARDS必須 | rate RPC権限維持 | なし | rate関数置換 |
| 017 | 通報認可wrapper | PASS | 必須・未適用記録 | 006,011 | report intake flag必須 | internalはserviceもEXECUTE不可 | なし | 旧受領rename＋新wrapper |
| 018 | Member原子参加 | PASS | 必須・未適用記録 | 002,003,009 | atomic join flag必須 | service join、direct write閉鎖維持 | なし | membership guard置換、join |
| 019 | Core申請承認原子化 | PASS | 必須・未適用記録 | 018 | atomic Core flag必須 | 旧join/Core RPCはserviceも剥奪 | snapshot列、FK追加なし | request/decide、pending unique |
| 020 | 退会privacy前提 | PASS | 必須・未適用記録 | 009,019 | account（まだOFF） | 旧request内部化、service wrapper | なし | 未公開Creator拒否・PII準備 |
| 021 | client最小読取・同意 | PASS | 必須・未適用記録 | 020 | mvp_room_list/明示列/同意RPC | 6表全ACL再構築＋restrictive、旧4view閉鎖 | なし | active/read helpers、同意RPC |
| 022 | 作品snapshot閲覧 | PASS | 必須・未適用記録 | 021 | works/drafts | 公開列GRANT、restrictive＋permissive | なし | can_read_work_draft |
| 023 | Auth独立保持主体 | PASS | 必須・未適用記録 | 001–022 | 新退会worker前提 | private schema/表全外部role閉鎖 | 監査Auth FK→actors RESTRICT、profiles維持 | Auth登録Trigger・Core拒否wrapper |
| 024 | 限定保持prepare・Storage証明 | PASS | 必須・未適用記録 | 023 | Preparation/Adapter | private helper閉鎖、限定worker RPC | 準備/清掃job参照は023 | guard置換・reports guard統合・prepare/verify |
| 025 | 遅延upload/未準備Auth削除防止 | PASS | 必須・未適用記録 | 024 | Storage SDK/worker | private helper閉鎖 | なし | storage.objects INSERT/Auth DELETE guard |
| 026 | Core履歴timestamp整合 | PASS | 必須・未適用記録 | 025＋監査set_updated_at | 同退会worker | private patch権限維持 | なし | patch_row置換、now()一致 |

## B. 破壊性・復旧・検収

共通 **F**: 当該SQLのBEGIN〜COMMIT内エラーはROLLBACK。成功済みファイルは再実行/逆順DROPしない。入口停止・証跡保全→現schema互換appまたはレビュー済み追補で前進復旧。旧広域ACL/旧RPCを復活させない。変更前のDB/Storage/Authの復元は別承認・隔離検証を要する。既存全行一括DELETEはないが、権限剥奪・FK変更・受付後の匿名化も破壊的変更として扱う。

| 番号 | 破壊性/動作変更 | rollback可否 | smoke（承認後の合成fixtureのみ） | STOP条件（共通STOPも適用） |
|---|---|---|---|---|
| 001 | 権限非互換 | F（自動downなし） | 他人添付拒否・二重消費なし | path受理/旧直接投稿成功 |
| 002 | 既存不正role拒否 | F（自動downなし） | Core5人目・kick再参加拒否 | 同意/role/定員逸脱 |
| 003 | 追加、旧同名衝突停止 | F（自動downなし） | 二重claim・不正stage拒否 | 二重lease/履歴消失 |
| 004 | 追加 | F（自動downなし） | 非運営拒否・監査atomic | 非運営成功/監査欠落 |
| 005 | 広域権限非互換 | F（自動downなし） | anon/auth列/行・旧RPC拒否 | 漏洩/未知関数ACL変更/読取不能 |
| 006 | 公開契約変更 | F（自動downなし） | 二重公開なし・hidden拒否 | 重複公開/未審査新log公開 |
| 007 | 追加 | F（自動downなし） | 他lease拒否・期限切れ拒否 | 旧leaseで更新可 |
| 008 | 追加 | F（自動downなし） | 一般role参照拒否 | snapshot漏洩/未知列 |
| 009 | 既存jobあれば適用拒否、受付時名義変更 | F（自動downなし） | 退会中通常write拒否 | 既存job/名前CHECK/guard競合 |
| 010 | guard動作変更 | F（自動downなし） | 退会対象hide/restore、本文不変 | 任意列変更/監査rollback失敗 |
| 011 | 通報経路変更 | F（自動downなし） | auto-hide失敗でもpending保持 | 受付消失/二重receipt |
| 012 | 追加 | F（自動downなし） | 非運営拒否・競合対応一意 | 二重対応/失敗を対応済みにする |
| 013 | 適用は追加、SDK清掃は不可逆 | F。Auth/Storage物理削除は復元不能 | used/unknown/退会owner除外 | 使用済み/不明pathが候補 |
| 014 | 権限非互換 | F（自動downなし） | 再送1結果・counter一致 | 二重増減/退会write許可 |
| 015 | 新経路必須 | F（自動downなし） | 失敗時room/memberとも戻る | 片側だけ作成/owner入力採用 |
| 016 | 制限値変更 | F（自動downなし） | account/room時間窓、429 | guard無効/想定外拒否 |
| 017 | 呼出先変更 | F（自動downなし） | 非参加/非表示拒否・再送保持 | internal直接実行可/重複受理 |
| 018 | identity immutable・45枠 | F（自動downなし） | 最終1枠・再参加role/同意 | 46人/role維持不正/旧fallback |
| 019 | 既存pending重複は適用失敗 | F（自動downなし） | 4枠/古い在籍申請拒否/旧RPC拒否 | 重複pending/復帰承認/旧RPC成功 |
| 020 | 受付時profile変更、適用時一括削除なし | F（自動downなし） | Creator拒否・同job再送 | Trigger差異/PII残り |
| 021 | 旧SELECT*・直接同意UPDATE非互換 | F（自動downなし） | 匿名/本人/Creator読取・既読API | 他人profile/列漏洩/login同意不能 |
| 022 | 読取契約変更 | F（自動downなし） | 匿名公開/参加中draft・hidden拒否 | 未公開snapshot漏洩/作品不能 |
| 023 | Auth全ID seed＋FK変更、単純down不可 | F。Auth/Storage物理削除は復元不能 | Auth新規参照・未知FK拒否 | 未知FK/column/新規Authとの競合 |
| 024 | 実行時profile削除/参照匿名化、不可逆部分あり | F。Auth/Storage物理削除は復元不能 | 8退会gate・他人行不変 | 所有不明/receipt欠落/row不一致 |
| 025 | 管理schema Trigger、未知legacyは別確認 | F。Auth/Storage物理削除は復元不能 | 隔離後upload拒否・準備前delete拒否 | 想定外managed schema/guard不発 |
| 026 | 比較を緩めず互換修正 | F。Auth/Storage物理削除は復元不能 | 実申請承認履歴あるCore退会 | 監査と異なるtimestamp/列更新 |

全番号共通STOP: 構文/列/制約/所有者/ACL/Trigger差異、ロック待ち期限超過、想定外更新、証跡未保存、対象誤認。処理途中の一般ユーザーsmokeは禁止。phase単位の統合smokeは全依存が揃ってから実施する。
005を017/019/020/023の後に再実行すると内部関数へservice権限を再付与し得る。復旧目的でも再実行禁止。
019の既存snapshotなしpendingは自動承認せず再申請。重複解消をmigration失敗後に無承認DELETEで行わない。
023は既存Auth IDをprivate actorsへseedし、Auth signupを止めた状態でFK/登録Triggerを一体適用する。

## C. ファイルと検収hash

`staging-schema-plan.json` / `staging-applied.json`を全26本照合。001〜020は保存bytesのSHA256、021〜026はLF正規化したSQLのSHA256で記録されている。両方式を区別して一致を確認した（単一方式で比較すると改行だけで不一致になる）。SQL/既存manifestは変更していない。本番実行台帳には実際の投入SQL bytesのhashと改行規則を記録し、SQL差分が改行以外にある場合STOP。

| 番号 | ファイル | 記録SHA256 | 記録方式 |
|---|---|---|---|
| 001 | [202610210001_attachment_ledger.sql](../supabase/migrations/202610210001_attachment_ledger.sql) | `df8c1f1284394a82d851c1d94b280e5b7056d4f1a72a8164928ce5583b7faa9e` | 保存bytes |
| 002 | [202610210002_membership_guards.sql](../supabase/migrations/202610210002_membership_guards.sql) | `3928eec22ad14f27c5e2610e5bccf881186da15c28f9ca6c6099498b44d8a7b9` | 保存bytes |
| 003 | [202610210003_account_jobs.sql](../supabase/migrations/202610210003_account_jobs.sql) | `426c0823f4157e71669af7d598a8d62e05dfd62f53898401e39c147ada5eaa1f` | 保存bytes |
| 004 | [202610210004_moderation.sql](../supabase/migrations/202610210004_moderation.sql) | `c57d3e1b524e38e4bc12b31b5c8b3c2a7bbb116baf2fe4ecacd3349e42bb7df1` | 保存bytes |
| 005 | [202610210005_read_boundaries.sql](../supabase/migrations/202610210005_read_boundaries.sql) | `b4b300ad764851e440dc82accb36b750502a189147ba1f64601b39cdee7e0a57` | 保存bytes |
| 006 | [202610210006_work_drafts.sql](../supabase/migrations/202610210006_work_drafts.sql) | `cd90edbb90a3e67a08404f99e41e3cbbfd395144bd9a62ac8d8de4130fb3acfe` | 保存bytes |
| 007 | [202610210007_deletion_lease.sql](../supabase/migrations/202610210007_deletion_lease.sql) | `0b2a878dbca1dbac88d3ac0390e6fbea3334d3c44f7ea1ce0105a9b36a5fa401` | 保存bytes |
| 008 | [202610210008_deletion_retention.sql](../supabase/migrations/202610210008_deletion_retention.sql) | `a65e75a10e93974fb1e2d5dc079001020c2baa580eb616ddb0d8b1c131967954` | 保存bytes |
| 009 | [202610210009_deletion_attribution_fence.sql](../supabase/migrations/202610210009_deletion_attribution_fence.sql) | `c1bf83184e67771d26be4de1eceb5d31ca2e0ece04a4bdd05083d94ea9871ace` | 保存bytes |
| 010 | [202610210010_scoped_moderation.sql](../supabase/migrations/202610210010_scoped_moderation.sql) | `d8579c87d301f43d33b265e985bd023ede440caf21e431d8b66087a7fff6ae57` | 保存bytes |
| 011 | [202610210011_report_intake.sql](../supabase/migrations/202610210011_report_intake.sql) | `4ffef9830595b51fdb48fb2399d3369609ae7d0455b8395149f097c840c4115b` | 保存bytes |
| 012 | [202610210012_report_queue.sql](../supabase/migrations/202610210012_report_queue.sql) | `7e23a30c8ce0e6c308a5530ae09f77a5774e631fa7b07faac2bee70b9e7c8b3a` | 保存bytes |
| 013 | [202610210013_upload_cleanup.sql](../supabase/migrations/202610210013_upload_cleanup.sql) | `8e58d926611ba4b0ae4710158f2709bf2813503c610119955612ca1c5f54478a` | 保存bytes |
| 014 | [202610210014_like_requests.sql](../supabase/migrations/202610210014_like_requests.sql) | `43d88408f4e5bacd9e593474b2747fe4a4749a0810b8be6ecfd7b1a3a47d3346` | 保存bytes |
| 015 | [202610210015_room_creation.sql](../supabase/migrations/202610210015_room_creation.sql) | `f3a2b5ce594a5b31c67cc7987cbd2d31c24fb978038a78afe58ce71d81323343` | 保存bytes |
| 016 | [202610210016_operator_rate_limits.sql](../supabase/migrations/202610210016_operator_rate_limits.sql) | `16b2a90e417cce270a0cbb310eb833aeebd9a7d6b0330f78ac27223129c6c03c` | 保存bytes |
| 017 | [202610210017_report_admission.sql](../supabase/migrations/202610210017_report_admission.sql) | `81ca8b6f81a71af6113dc2ccb5cda20d78d8d6e6d0cc1e2c81d37b182d434bec` | 保存bytes |
| 018 | [202610210018_member_admission.sql](../supabase/migrations/202610210018_member_admission.sql) | `a6d48e10bd219abf591a4125485054bf384dbc74a0594cd4c077dc892becd2ba` | 保存bytes |
| 019 | [202610210019_core_admission.sql](../supabase/migrations/202610210019_core_admission.sql) | `9376a676a4bd8769f826f7cde5873c650386e1b6c3a6c75762425f99facbb112` | 保存bytes |
| 020 | [202610210020_deletion_privacy_preconditions.sql](../supabase/migrations/202610210020_deletion_privacy_preconditions.sql) | `7f11c8cf48a97ebbd9a4b2119564d17ad50ab1d76a9a95047466c7bca3bda39a` | 保存bytes |
| 021 | [202610210021_client_read_contract.sql](../supabase/migrations/202610210021_client_read_contract.sql) | `195b89a976f1d4a4a6f1835d3e940f93533458dae4ef80b76da9751a89d27ba9` | LF正規化 |
| 022 | [202610210022_work_snapshot_read.sql](../supabase/migrations/202610210022_work_snapshot_read.sql) | `fa4166feecba92b3200173011e01815454539ba9b969045bf0782e12d2658789` | LF正規化 |
| 023 | [202610210023_retained_actors.sql](../supabase/migrations/202610210023_retained_actors.sql) | `f678ca5e545dc35ed865bead4dbff1fb95759831844bd1a03779921194b48b47` | LF正規化 |
| 024 | [202610210024_deletion_prepare.sql](../supabase/migrations/202610210024_deletion_prepare.sql) | `583c192900a844139ed5d64c440f1f6582a382ae8e07b8b5fc2edcfe682ab130` | LF正規化 |
| 025 | [202610210025_deletion_upload_fence.sql](../supabase/migrations/202610210025_deletion_upload_fence.sql) | `5a10b0f52999a9b882194e297daf06894a0b645ff54c9a767cae55c553849b12` | LF正規化 |
| 026 | [202610220026_deletion_request_timestamp.sql](../supabase/migrations/202610220026_deletion_request_timestamp.sql) | `09524d7cda55a9b55bddc1298dd3f89deb8ae0eeb017383a198fd12af63e768e` | LF正規化 |


<details>
<summary>更新前の記録（履歴。現在の判定・実行順には使用しない）</summary>

# Migration検収台帳（第42節）
2026-10-21。001〜017を全件ソースレビュー、018を追加。全てローカル候補・本番未適用。stagingで全順序適用は未検証。番号順を保ち、適用済みSQLを再実行しない。
## 共通の復旧契約
各ファイルはBEGIN/COMMITを含む。途中エラーは当該transactionをROLLBACK。コミット済みは逆順DROPしない。データ/receipt/監査は残し、機能停止→互換appまたはレビュー済み前進修正。旧広域policyや匿名EXECUTEの復活をrollbackにしない。DB復元は検証済みbackup/整合snapshotと書込停止のうえ別承認。Auth/Storage削除はDB rollback不能。以下のrollback欄はこの共通契約を含む。
破壊性は物理DELETEだけでなく、既存clientの権限喪失・Triggerによる失敗を含む。既存行を一括削除するmigrationはない。009は適用時に既存job検査、受付RPC実行時に名義変更する。001/005/014は権限縮小と追加DDLが同居し、純粋なexpand段階として適用できない。

## 001 添付台帳・投稿原子性・rate
- ファイル: 202610210001_attachment_ledger.sql / SHA256: df8c1f1284394a82d851c1d94b280e5b7056d4f1a72a8164928ce5583b7faa9e
- 対象: public.attachment_uploads, public.post_requests, public.mvp_rate_limits, public.mvp_take_rate_limit, public.create_post_with_upload
- 前提: 既存 rooms/posts/members/profiles/auth。後続: 002,013,016。
- 破壊性/互換性: postsのtable/column DML剥奪。旧直接投稿は非互換。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: 台帳owner/room/postはSET NULL、post_requests.postはSET NULL。used_atは保持。
- RLS/GRANT: ALTER TABLE public.attachment_uploads ENABLE ROW LEVEL SECURITY; / ALTER TABLE public.post_requests ENABLE ROW LEVEL SECURITY; / ALTER TABLE public.mvp_rate_limits ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.attachment_uploads, public.post_requests, public.mvp_rate_limits FROM PUBLIC, anon, authenticated; / GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachment_uploads, public.post_requests, public.mvp_rate_limits TO service_role; / REVOKE ALL ON FUNCTION public.create_post_with_upload(uuid,uuid,text,text,uuid,uuid) FROM PUBLIC, anon, authenticated; / REVOKE ALL ON FUNCTION public.mvp_take_rate_limit(uuid,text) FROM PUBLIC, anon, authenticated; / GRANT EXECUTE ON FUNCTION public.create_post_with_upload(uuid,uuid,text,text,uuid,uuid) TO service_role; / GRANT EXECUTE ON FUNCTION public.mvp_take_rate_limit(uuid,text) TO service_role; / REVOKE INSERT, UPDATE, DELETE ON public.posts FROM PUBLIC, anon, authenticated;
- RPC/SECURITY: public.mvp_take_rate_limit INVOKER, public.create_post_with_upload INVOKER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: 台帳のみ。実object削除は別API・不可逆
- account deletion: 退会中の書込拒否とAuth FK/CASCADEの回帰検収が必要
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 台帳/投稿RPC・他人path・二重消費・旧作品署名。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 002 Core4・kick・highlight
- ファイル: 202610210002_membership_guards.sql / SHA256: 3928eec22ad14f27c5e2610e5bccf881186da15c28f9ca6c6099498b44d8a7b9
- 対象: public.room_exclusions, public.mvp_guard_membership, mvp_membership_guard, public.mvp_manage_member, public.mvp_guard_core_request, mvp_core_request_guard, public.mvp_highlight
- 前提: 001と既存membership/申請表。後続: 005,018。
- 破壊性/互換性: 既存のCore5人目/非正規role変更を拒否。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: room_exclusions.room→rooms CASCADE。既存membershipのFKは変更なし。
- RLS/GRANT: ALTER TABLE public.room_exclusions ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.room_exclusions FROM PUBLIC,anon,authenticated; / GRANT ALL ON public.room_exclusions TO service_role; / REVOKE ALL ON FUNCTION public.mvp_guard_membership() FROM PUBLIC,anon,authenticated; / REVOKE ALL ON FUNCTION public.mvp_manage_member(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_manage_member(uuid,uuid,uuid,text) TO service_role; / REVOKE ALL ON FUNCTION public.mvp_guard_core_request() FROM PUBLIC,anon,authenticated; / REVOKE ALL ON FUNCTION public.mvp_highlight(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_highlight(uuid,uuid,uuid,boolean) TO service_role;
- RPC/SECURITY: public.mvp_guard_membership DEFINER, public.mvp_manage_member INVOKER, public.mvp_guard_core_request DEFINER, public.mvp_highlight INVOKER
- Trigger: 既存Triggerを追加/置換またはTrigger関数を更新。順序と既存副作用はstaging必須
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会中の書込拒否とAuth FK/CASCADEの回帰検収が必要
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 旧RPCとTrigger順、Core4、kick、降格・退出。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 003 退会永続job・CAS
- ファイル: 202610210003_account_jobs.sql / SHA256: 426c0823f4157e71669af7d598a8d62e05dfd62f53898401e39c147ada5eaa1f
- 対象: public.account_deletion_jobs, public.mvp_claim_deletion, public.mvp_advance_deletion, public.mvp_request_deletion
- 前提: 既存role。後続: 007,008,009,013,014,015,018。
- 破壊性/互換性: 既存行の変更なし。受付を有効にしない。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: Auth FKなし。Auth消失でもjob保持。
- RLS/GRANT: ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.account_deletion_jobs FROM PUBLIC,anon,authenticated; / GRANT ALL ON public.account_deletion_jobs TO service_role; / REVOKE ALL ON FUNCTION public.mvp_claim_deletion(uuid), public.mvp_advance_deletion(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_claim_deletion(uuid), public.mvp_advance_deletion(uuid,uuid,text,text) TO service_role; / REVOKE ALL ON FUNCTION public.mvp_request_deletion(uuid,text,text) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_request_deletion(uuid,text,text) TO service_role;
- RPC/SECURITY: public.mvp_claim_deletion INVOKER, public.mvp_advance_deletion INVOKER, public.mvp_request_deletion INVOKER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会job/保持/書込停止と密結合、単独受付有効化禁止
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: lease競合・不正遷移・同申請不一致。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 004 運営担当・非表示監査
- ファイル: 202610210004_moderation.sql / SHA256: c57d3e1b524e38e4bc12b31b5c8b3c2a7bbb116baf2fe4ecacd3349e42bb7df1
- 対象: public.moderation_operators, public.moderation_actions, public.mvp_moderate
- 前提: 既存rooms/posts。後続: 010,012。
- 破壊性/互換性: 新しい運営専用入口。旧関数と同名衝突は停止。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: 追加FKなし、Auth削除で監査を消さない。
- RLS/GRANT: ALTER TABLE public.moderation_operators ENABLE ROW LEVEL SECURITY; / ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.moderation_operators,public.moderation_actions FROM PUBLIC,anon,authenticated; / GRANT ALL ON public.moderation_operators,public.moderation_actions TO service_role; / REVOKE ALL ON FUNCTION public.mvp_moderate(uuid,text,uuid,text,boolean,uuid) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_moderate(uuid,text,uuid,text,boolean,uuid) TO service_role;
- RPC/SECURITY: public.mvp_moderate INVOKER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会中の書込拒否とAuth FK/CASCADEの回帰検収が必要
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 非運営拒否、監査失敗全rollback。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 005 restrictive閲覧境界・招待列・DML/RPC制限
- ファイル: 202610210005_read_boundaries.sql / SHA256: b4b300ad764851e440dc82accb36b750502a189147ba1f64601b39cdee7e0a57
- 対象: public.mvp_can_read_room_posts, public.posts, public.rooms, public.room_members, mvp_posts_boundary, mvp_rooms_boundary, mvp_members_boundary
- 前提: 002、既存4views/旧関数の全定義照合。後続: 006,017。
- 破壊性/互換性: 全public SECURITY DEFINER実行権限を一括変更。SELECT *や旧clientを破壊し得る。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: FK変更なし。
- RLS/GRANT: REVOKE ALL ON FUNCTION public.mvp_can_read_room_posts(uuid) FROM PUBLIC; / GRANT EXECUTE ON FUNCTION public.mvp_can_read_room_posts(uuid) TO anon,authenticated,service_role; / ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY; / ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY; / ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY; / CREATE POLICY mvp_posts_boundary ON public.posts AS RESTRICTIVE FOR SELECT TO anon,authenticated / CREATE POLICY mvp_rooms_boundary ON public.rooms AS RESTRICTIVE FOR SELECT TO anon,authenticated / CREATE POLICY mvp_members_boundary ON public.room_members AS RESTRICTIVE FOR SELECT TO anon,authenticated / REVOKE INSERT,UPDATE,DELETE ON public.rooms,public.room_members,public.room_join_requests FROM PUBLIC,anon,authenticated; / REVOKE SELECT ON public.rooms FROM PUBLIC,anon,authenticated;
- RPC/SECURITY: public.mvp_can_read_room_posts DEFINER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会中の書込拒否とAuth FK/CASCADEの回帰検収が必要
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。⑤のACL一括操作は適用前定義と署名単位で差分比較。危険な旧ACLへは戻さない。
- staging必須: anon/auth/service全列・4view人数・invoker関数・旧直接RPCを検証。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 006 draft版管理・期限公開・ログ審査
- ファイル: 202610210006_work_drafts.sql / SHA256: cd90edbb90a3e67a08404f99e41e3cbbfd395144bd9a62ac8d8de4130fb3acfe
- 対象: public.work_drafts, work_draft_read, public.mvp_save_draft, public.mvp_publish_due, public.post_publication_reviews, public.mvp_review_log, public.mvp_public_post_allowed, mvp_public_log_boundary
- 前提: 005（閲覧helper）、002（role）。後続: 017。
- 破壊性/互換性: 既存公開ログはdraftなしなら許可する互換分岐あり。PII解決ではない。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: work_drafts.room RESTRICT、review.post CASCADE。
- RLS/GRANT: ALTER TABLE public.work_drafts ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.work_drafts FROM PUBLIC,anon,authenticated; / GRANT ALL ON public.work_drafts TO service_role; / GRANT SELECT ON public.work_drafts TO anon,authenticated; / CREATE POLICY work_draft_read ON public.work_drafts FOR SELECT TO anon,authenticated / REVOKE ALL ON FUNCTION public.mvp_save_draft(uuid,uuid,integer,jsonb),public.mvp_publish_due() FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_save_draft(uuid,uuid,integer,jsonb),public.mvp_publish_due() TO service_role; / ALTER TABLE public.post_publication_reviews ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.post_publication_reviews FROM PUBLIC,anon,authenticated; / GRANT ALL ON public.post_publication_reviews TO service_role; / REVOKE ALL ON FUNCTION public.mvp_review_log(uuid,uuid,uuid,boolean,text),public.mvp_public_post_allowed(uuid) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_review_log(uuid,uuid,uuid,boolean,text) TO service_role; / GRANT EXECUTE ON FUNCTION public.mvp_public_post_allowed(uuid) TO anon,authenticated,service_role; / CREATE POLICY mvp_public_log_boundary ON public.posts AS RESTRICTIVE FOR SELECT TO anon,authenticated
- RPC/SECURITY: public.mvp_save_draft INVOKER, public.mvp_publish_due INVOKER, public.mvp_review_log INVOKER, public.mvp_public_post_allowed DEFINER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会中の書込拒否とAuth FK/CASCADEの回帰検収が必要
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 公開前後の審査・ハッシュ・同時cron・失敗再試行。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 007 退会lease更新・解放
- ファイル: 202610210007_deletion_lease.sql / SHA256: 0b2a878dbca1dbac88d3ac0390e6fbea3334d3c44f7ea1ce0105a9b36a5fa401
- 対象: public.mvp_renew_deletion, public.mvp_release_deletion
- 前提: 003。後続: 008,adapter。
- 破壊性/互換性: 既存API互換、worker未接続。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: FK変更なし。
- RLS/GRANT: REVOKE ALL ON FUNCTION public.mvp_renew_deletion(uuid,uuid,text),public.mvp_release_deletion(uuid,uuid) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_renew_deletion(uuid,uuid,text),public.mvp_release_deletion(uuid,uuid) TO service_role;
- RPC/SECURITY: public.mvp_renew_deletion INVOKER, public.mvp_release_deletion INVOKER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会job/保持/書込停止と密結合、単独受付有効化禁止
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 期限切れ/別lease/別stage拒否。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 008 制作履歴復旧snapshot
- ファイル: 202610210008_deletion_retention.sql / SHA256: a65e75a10e93974fb1e2d5dc079001020c2baa580eb616ddb0d8b1c131967954
- 対象: public.account_deletion_retention, public.mvp_snapshot_deletion_history
- 前提: 003、監査済みdecisions/event_members/pre_archive_notes。後続: 009,退会prepare。
- 破壊性/互換性: 原本は変更しない。snapshot本文にも個人情報の可能性、運営限定。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: retention.job RESTRICT。
- RLS/GRANT: ALTER TABLE public.account_deletion_retention ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.account_deletion_retention FROM PUBLIC,anon,authenticated; / GRANT SELECT,INSERT ON public.account_deletion_retention TO service_role; / REVOKE ALL ON FUNCTION public.mvp_snapshot_deletion_history(uuid,uuid) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_snapshot_deletion_history(uuid,uuid) TO service_role;
- RPC/SECURITY: public.mvp_snapshot_deletion_history INVOKER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会job/保持/書込停止と密結合、単独受付有効化禁止
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 列/型照合、snapshot再送不一致、公開保持と区別。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 009 退会名義と書込停止
- ファイル: 202610210009_deletion_attribution_fence.sql / SHA256: 1529db815a4e793bbfc4d52715a925249e29bc3e191926ac97b4ebb18622ff3c
- 対象: public.account_departed_authors, public.mvp_guard_departing_write, zz_mvp_departing_write, public.mvp_request_deletion, public.mvp_departed_author_labels
- 前提: 003、監査済み11必須表、008準備。後続: 010,011。
- 破壊性/互換性: 既存jobが1件でもあると適用失敗。受付時に複数表名義UPDATE、全対象書込へTrigger。
- data migration: 適用時既存job検査。受付時名義更新、bulk backfillなし。
- FK/CASCADE: departed_authors.job RESTRICT。既存Auth CASCADEがTriggerで止まり得る。
- RLS/GRANT: ALTER TABLE public.account_departed_authors ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.account_departed_authors FROM PUBLIC,anon,authenticated; / GRANT SELECT,INSERT ON public.account_departed_authors TO service_role; / REVOKE ALL ON FUNCTION public.mvp_guard_departing_write() FROM PUBLIC,anon,authenticated; / REVOKE ALL ON FUNCTION public.mvp_departed_author_labels(uuid[]) FROM PUBLIC; / GRANT EXECUTE ON FUNCTION public.mvp_departed_author_labels(uuid[]) TO anon,authenticated,service_role;
- RPC/SECURITY: public.mvp_guard_departing_write DEFINER, public.mvp_request_deletion INVOKER, public.mvp_departed_author_labels DEFINER
- Trigger: 既存Triggerを追加/置換またはTrigger関数を更新。順序と既存副作用はstaging必須
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会job/保持/書込停止と密結合、単独受付有効化禁止
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 全Trigger順・名義戻し・Auth CASCADE・既読/運営/期限公開。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 010 退会中対象への限定運営
- ファイル: 202610210010_scoped_moderation.sql / SHA256: d8579c87d301f43d33b265e985bd023ede440caf21e431d8b66087a7fff6ae57
- 対象: public.mvp_moderation_capabilities, public.mvp_guard_departing_write, public.mvp_moderate
- 前提: 003,004,009。後続: 011,012。
- 破壊性/互換性: mvp_moderateとguard置換。is_hidden以外のTrigger副作用で停止。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: FK変更なし。
- RLS/GRANT: ALTER TABLE public.mvp_moderation_capabilities ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.mvp_moderation_capabilities FROM PUBLIC,anon,authenticated,service_role; / REVOKE ALL ON FUNCTION public.mvp_guard_departing_write() FROM PUBLIC,anon,authenticated; / REVOKE ALL ON FUNCTION public.mvp_moderate(uuid,text,uuid,text,boolean,uuid) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_moderate(uuid,text,uuid,text,boolean,uuid) TO service_role;
- RPC/SECURITY: public.mvp_guard_departing_write DEFINER, public.mvp_moderate DEFINER
- Trigger: 既存Triggerを追加/置換またはTrigger関数を更新。順序と既存副作用はstaging必須
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会job/保持/書込停止と密結合、単独受付有効化禁止
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 前後全行比較・一回capability・監査原子性。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 011 失敗しても通報受付保持
- ファイル: 202610210011_report_intake.sql / SHA256: 1f875de5ad86ff9215aead748c3ef246accad0b01fa1e434b9ae907d7fc38e17
- 対象: public.report_intake, public.mvp_receive_report, zz_mvp_reporter_withdrawal
- 前提: 003,009,010、実reports列/Trigger。後続: 012,017。
- 破壊性/互換性: 新受付表、旧reports INSERTをsubtransaction。reporter専用Trigger追加。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: 受付はAuth FKなし。
- RLS/GRANT: ALTER TABLE public.report_intake ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.report_intake FROM PUBLIC,anon,authenticated; / GRANT SELECT,INSERT,UPDATE ON public.report_intake TO service_role; / REVOKE ALL ON FUNCTION public.mvp_receive_report(uuid,uuid,text,uuid,text) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_receive_report(uuid,uuid,text,uuid,text) TO service_role;
- RPC/SECURITY: public.mvp_receive_report INVOKER
- Trigger: 既存Triggerを追加/置換またはTrigger関数を更新。順序と既存副作用はstaging必須
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会job/保持/書込停止と密結合、単独受付有効化禁止
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 旧Trigger例外/キャンセル、退会者通報、同ID再送。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 012 運営一覧・解決履歴
- ファイル: 202610210012_report_queue.sql / SHA256: 7e23a30c8ce0e6c308a5530ae09f77a5774e631fa7b07faac2bee70b9e7c8b3a
- 対象: public.report_resolutions, public.mvp_require_report_operator, public.mvp_pending_reports, public.mvp_resolve_report
- 前提: 004,010,011。後続: 運営UI。
- 破壊性/互換性: 一般roleとservice直接解決表操作不可。内部helperもservice不可。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: resolution.receipt RESTRICT。
- RLS/GRANT: ALTER TABLE public.report_resolutions ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.report_resolutions FROM PUBLIC,anon,authenticated,service_role; / REVOKE ALL ON FUNCTION public.mvp_require_report_operator(uuid) FROM PUBLIC,anon,authenticated,service_role; / REVOKE ALL ON FUNCTION public.mvp_pending_reports(uuid,timestamptz,uuid),public.mvp_resolve_report(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_pending_reports(uuid,timestamptz,uuid),public.mvp_resolve_report(uuid,uuid,uuid,text,text) TO service_role;
- RPC/SECURITY: public.mvp_require_report_operator DEFINER, public.mvp_pending_reports DEFINER, public.mvp_resolve_report DEFINER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会job/保持/書込停止と密結合、単独受付有効化禁止
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 同時対応/取消/退会/監査rollback/滞留cursor。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 013 unused清掃lease
- ファイル: 202610210013_upload_cleanup.sql / SHA256: 8e58d926611ba4b0ae4710158f2709bf2813503c610119955612ca1c5f54478a
- 対象: public.attachment_uploads, public.mvp_claim_upload_cleanup, public.mvp_finish_upload_cleanup
- 前提: 001,003,009。後続: 清掃worker（未接続）。
- 破壊性/互換性: 台帳に4列追加。外部削除はSQL適用だけでは発生しない。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: FK変更なし。
- RLS/GRANT: REVOKE ALL ON FUNCTION public.mvp_claim_upload_cleanup(),public.mvp_finish_upload_cleanup(uuid,uuid) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_claim_upload_cleanup(),public.mvp_finish_upload_cleanup(uuid,uuid) TO service_role;
- RPC/SECURITY: public.mvp_claim_upload_cleanup DEFINER, public.mvp_finish_upload_cleanup DEFINER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: 台帳のみ。実object削除は別API・不可逆
- account deletion: 退会job/保持/書込停止と密結合、単独受付有効化禁止
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: used/legacy/退会owner保持、Storage成功応答消失、古いlease。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 014 いいねdesired-state
- ファイル: 202610210014_like_requests.sql / SHA256: 43d88408f4e5bacd9e593474b2747fe4a4749a0810b8be6ecfd7b1a3a47d3346
- 対象: public.room_like_requests, public.mvp_set_room_like
- 前提: 003、room_likes。後続: like UI/API。
- 破壊性/互換性: room_likes直接DML/列権限剥奪。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: 新requestはAuth FKなし。
- RLS/GRANT: ALTER TABLE public.room_like_requests ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.room_like_requests FROM PUBLIC,anon,authenticated,service_role; / REVOKE ALL ON FUNCTION public.mvp_set_room_like(uuid,uuid,boolean,boolean,uuid) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_set_room_like(uuid,uuid,boolean,boolean,uuid) TO service_role; / REVOKE INSERT,UPDATE,DELETE ON public.room_likes FROM PUBLIC,anon,authenticated;
- RPC/SECURITY: public.mvp_set_room_like DEFINER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会中の書込拒否とAuth FK/CASCADEの回帰検収が必要
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 同時retry・後続unlikeを古いreplayで戻さない。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 015 roomとCreator原子作成
- ファイル: 202610210015_room_creation.sql / SHA256: f3a2b5ce594a5b31c67cc7987cbd2d31c24fb978038a78afe58ce71d81323343
- 対象: public.room_creation_requests, public.mvp_create_room
- 前提: 002,003、rooms型照合。後続: room create UI/API。
- 破壊性/互換性: 新RPC、新request。既存物理room削除とRESTRICTは非互換。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: request.room RESTRICT。
- RLS/GRANT: ALTER TABLE public.room_creation_requests ENABLE ROW LEVEL SECURITY; / REVOKE ALL ON public.room_creation_requests FROM PUBLIC,anon,authenticated,service_role; / REVOKE ALL ON FUNCTION public.mvp_create_room(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_create_room(uuid,uuid,jsonb) TO service_role;
- RPC/SECURITY: public.mvp_create_room DEFINER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会中の書込拒否とAuth FK/CASCADEの回帰検収が必要
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: Triggerでmembership失敗→roomもrollback、設定hash再送。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 016 運営・退会rate拡張
- ファイル: 202610210016_operator_rate_limits.sql / SHA256: 16b2a90e417cce270a0cbb310eb833aeebd9a7d6b0330f78ac27223129c6c03c
- 対象: public.mvp_take_rate_limit
- 前提: 001。後続: 運営/退会API。
- 破壊性/互換性: 既存rate関数置換、旧action維持。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: FK変更なし。
- RLS/GRANT: REVOKE ALL ON FUNCTION public.mvp_take_rate_limit(uuid,text) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_take_rate_limit(uuid,text) TO service_role;
- RPC/SECURITY: public.mvp_take_rate_limit INVOKER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会中の書込拒否とAuth FK/CASCADEの回帰検収が必要
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 同window競合、上限、503安全停止。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 017 通報対象認可・重複防止
- ファイル: 202610210017_report_admission.sql / SHA256: 81ca8b6f81a71af6113dc2ccb5cda20d78d8d6e6d0cc1e2c81d37b182d434bec
- 対象: public.mvp_receive_report
- 前提: 006,011,012。後続: 通報有効化。
- 破壊性/互換性: 旧関数をinternalへ改名・EXECUTE剥奪。005を後から再実行禁止。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: FK変更なし。
- RLS/GRANT: REVOKE ALL ON FUNCTION public.mvp_receive_report_internal(uuid,uuid,text,uuid,text) FROM PUBLIC,anon,authenticated,service_role; / REVOKE ALL ON FUNCTION public.mvp_receive_report(uuid,uuid,text,uuid,text) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_receive_report(uuid,uuid,text,uuid,text) TO service_role;
- RPC/SECURITY: public.mvp_receive_report DEFINER
- Trigger: 新規Triggerなし。既存Triggerの副作用は継続
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会中の書込拒否とAuth FK/CASCADEの回帰検収が必要
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: private非参加拒否、hidden後receipt再送、internal拒否。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

## 018 Member45・原子的参加/同意
- ファイル: 202610210018_member_admission.sql / SHA256: a6d48e10bd219abf591a4125485054bf384dbc74a0594cd4c077dc892becd2ba
- 対象: public.mvp_guard_membership, public.mvp_join_member
- 前提: 002,003、既存同意列、001〜017の後。後続: MVP_ATOMIC_JOIN_ENABLED。
- 破壊性/互換性: READ COMMITTED必須、membershipキー変更不可、満員時Core→Member降格も拒否。
- data migration: 適用時の既存ユーザー行backfill/削除なし。RPC実行時の更新は上記目的に限定。
- FK/CASCADE: FK変更なし、既存room/user UNIQUE必須。
- RLS/GRANT: REVOKE ALL ON FUNCTION public.mvp_guard_membership() FROM PUBLIC,anon,authenticated; / REVOKE ALL ON FUNCTION public.mvp_join_member(uuid,uuid,text) FROM PUBLIC,anon,authenticated; / GRANT EXECUTE ON FUNCTION public.mvp_join_member(uuid,uuid,text) TO service_role;
- RPC/SECURITY: public.mvp_guard_membership DEFINER, public.mvp_join_member DEFINER
- Trigger: 既存Triggerを追加/置換またはTrigger関数を更新。順序と既存副作用はstaging必須
- Storage: Storage設定変更なし。実署名/保持の回帰は別検収
- account deletion: 退会中の書込拒否とAuth FK/CASCADEの回帰検収が必要
- rollback: 当該機能を停止し既存記録を保持。共通復旧契約に従う。
- staging必須: 最終枠/重複/追放/退会/同意原子性、旧RPC互換。
- 判定: ソースレビュー済み、合成テストあり、staging BLOCKED。

</details>

</details>

</details>

</details>
