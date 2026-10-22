# 第52節・実行可能な本番停止/復旧（最新）

最新添付6a13bc98で本番操作承認済み。実行者はこのCodexセッション、運営窓口はプロジェクト所有者が管理する minnadetsukuru.auth@gmail.com。旧節の別承認待ち/未実証記述より本節を優先。通常日次確認は所有者が担当し、不在時は募集拡大を止める。24時間有人対応を保証しない。

1. repoで `node scripts/release/production.cjs preflight joedeuyrzimqyjapqpyh` を実行。backup/restore/hash/staging停止証拠を自動照合。秘密は現在のWindowsユーザー専用DPAPIから読み、表示しない。
2. 初回rolloutは `node scripts/release/production.cjs stop joedeuyrzimqyjapqpyh`。public既存表＋Auth/Storage17表のstatement guardを確認。管理接続以外の書込を停止し、読み取りは維持。DB lock待機上限10秒。長期停止を避け、失敗時は原因修正か今回追加したguardのみ解除する。旧RLS/GRANTを復活させない。
3. 停止中にbackup→isolated restoreを更新する。復元先は127.0.0.1/私的ACL/全復元role NOLOGIN。Storage実体は別AES backup。秘密・PIIは出力せず比較結果のみ記録。元backupを保持。
4. 001〜028を小さいphaseごとにapply、直前hash/各transaction成功/new table RLS/phase構造確認。failed_or_unknownは再実行せず確認。新app配信まではguardを維持する。
5. Vercelは本番project minnade-tsukuru。退会2flag無効・DB pause維持で互換appを配信。Ready後に `node scripts/release/production.cjs resume joedeuyrzimqyjapqpyh`。guard0/pause=trueを確認してTESTのみで検収。
6. 緊急退会停止はowner SQL `SELECT public.mvp_set_deletion_pause(true);` を最優先。続いてREQUESTS/FINALIZEを無効にして再配信。in-flight/effect/Storage/Auth照合は以下の専用runbook。env変更だけで進行中処理は止まらない。
7. Upload停止はUPLOADS無効＋再配信、公開済み添付の読取は保持。公開停止はDRAFTS無効＋再配信/cron停止。一般書込を即時止める場合は本節の一時guard SQLを対象・関数存在を確認して利用。Authログインも一時停止される。
8. 全体復旧は原因修正/DB整合/Storage/Auth照合→互換app Ready→guard解除→TEST smoke→退会最後に再開。既発行signed URLの読取はguardで失効しない。旧危険権限へ戻さない。5〜10人限定公開後24hを重点監視。

復元制約: FreeでPITRなし。外部SMTP/OAuth設定・Vault root keyはlogical dumpから完全再現できない。DPAPI復号は現在のWindows profileが必要。別端末復旧は未実証。

# 本番反映計画（第51節、2026-10-22）

条件付き承認あり、**本番適用は未開始**。[最終検収](RELEASE_FINAL_ACCEPTANCE.md)を優先する。Android resetを含めPASS、iPhoneは今回必須から除外し公開後確認へ。最新PreviewはReady。

1. DB/Auth/Storageの保全担当・暗号化保存先・整合時点と隔離復元を確認。Free backup/PITRなしを前提にし、schema-onlyをdata backupと呼ばない。エージェントによる本番PII/本文取得は今回行わない。
2. 保守境界を確定・staging実演する。app/旧deployment/cron/workerとSupabase REST/旧RPC/Auth/Storageの入口を個別に拒否確認し、管理接続だけを維持。feature flagや027 pauseだけで全体を停止したとしない。未実証ならここでSTOP。
3. 001→028を個別transaction/構造smoke/hash記録で適用。追加DDLとACL縮小が混在し、順序を切り貼りしない。005を後段後に再実行しない。019重複/023未知FK/025managed Trigger不一致はSTOP。
4. 互換appを配信しTESTのみで機能/security smoke。DB_GUARDS=true、退会2flag=false、その他は停止境界内で段階的に有効化。既存main自動配信がDB互換より先に起動しない順を維持。
5. pause/drain/Storage/Auth checkpoint/復旧担当を再確認し退会TESTを最後に行う。全PASS後だけ5〜10人β→24h監視→段階拡大、iPhone公開後検収。

本番の全入口保守を実現する新しいDB guard等はまだ実装・適用していない。必要なら独立した最小追補案をレビューし、凍結001〜028を編集しない。SQL dump/復元を実行済み、global maintenanceが有効、と誤認しない。

rollbackは未commit transactionのROLLBACKと互換app/前進修正。権限を旧広域設定へ戻さない。Auth/Storage物理削除はapp rollbackで復元不能。

<details>
<summary>第50節以前の記録（現在の判定は上記を優先）</summary>

# 本番反映計画（第50節、2026-10-22）

**条件付き承認あり・本番未実行。** 全Go条件と未達は[最終検収](RELEASE_FINAL_ACCEPTANCE.md)。対象は既存production joedeuyrzimqyjapqpyh / Vercel minnade-tsukuru、隔離stagingと取り違えない。

1. 実メール/reset・両実機、担当/保守時間、SMTP、保全復元を完了。本番FreeにはDashboard backupがないことを確認済み。schema-only情報だけでユーザー行/Storage実体を復元できるとは扱わない。
2. 全入口停止/cron停止/worker drainの境界を確認し、既存schemaを最小read-onlyで再照合。今回の14表等の存在集計だけでは全互換を保証しない。
3. 001→028を個別transaction・構造smoke・hash記録で進める。中間で一般利用を再開しない。既適用staging SQLは不変、baseline/verification/合成fixtureは本番対象外。
4. 028対応同意/callback/resetを含む互換appを配信。001/005/014/021にはDDL/権限縮小が混在し、単純なadditive→app→permission後回しに並べ替えられない。停止境界内で番号順を維持する。
5. TESTのみで機能/security smoke、退会はpause/drain/Storage/Auth checkpoint確認後に最後にenable。旧広域ACL/旧APIへfallbackしない。
6. 5〜10人限定公開→24h重点監視→Production GO再判定。現時点でこれらは未実行。

028のrollbackは同意列/記録を保全して停止・前進修正。旧2引数同意RPCを復活させない。Auth/Storage物理削除はapp rollbackで戻らない。本番自動deployを生むmainへの反映はDB互換・停止境界より先に実行しない。

<details>
<summary>第49節以前の記録（最新判断は上記を優先）</summary>

# 本番反映計画（第49節、2026-10-22）

**本番操作未承認・未実行。** 今回は027を隔離stagingへ追加し停止/再開を実証した。最新flagは[FEATURE_FLAG_MATRIX](FEATURE_FLAG_MATRIX.md)、実行中退会の停止/結果照合/再開は[DELETION_STOP_RECOVERY](DELETION_STOP_RECOVERY.md)を使う。旧節の「OFFで旧書込へ戻る」「退会pause未実装」は過去状態。

## 実行順序と停止条件

1. primary・実行者・確認者・対象project/release tree・予定保守時間・上限・連絡先を記録。公開連絡先は minnadetsukuru.auth@gmail.com（意図された公開連絡先）。メール/端末/法務/保持/PII担当の条件を満たすまで公開しない。
2. 別承認で本番の最小カタログと既存job/Storage整合を確認する。baselineや合成fixtureは本番に適用しない。既存状態が監査前提と異なればSTOP。
3. DB/Auth/Storage実体を別に保全し、復元可能範囲・実行担当・所要時間・過去削除の再適用を実証する。全入口保守（app/直接REST/Storage/Auth登録/旧RPC/cron）と既存worker drainを確認する。退会pauseだけでこの全体境界を満たしたとはしない。
4. 停止境界内で001→027を番号順・各transactionで適用。001〜026は以前の適用検証済みbytesを維持。027はcontrol初期true、新worker関数、Owner限定switch、Auth guard。旧workerがStorage permit外で動かないよう027前にdrainする。各SQLのhash/成功/ACL/Triggerを記録し、失敗したらrollbackして次へ進まない。
5. 互換appを配信。初期はDB_GUARDS=true、他の操作flagはfalse、退会pause=true。TESTのみに入口を限定して非退会flagを段階的にtrueへ。旧広域GRANT/旧APIを開けて互換性を作らない。
6. TEST限定で認証・同意・作成/参加/Core・投稿/添付・既読・作品・like/report・運営/監査を検収。任意の本番ユーザーでnegative testをしない。forced publishは全期限room対象のため手動一括RPCをsmokeに使わず、正式再開時の影響を別確認する。
7. 退会は最後。REQUESTS/FINALIZEの互換設定、Owner pause/retry当番、既存job、物理削除の限界を確認。まずTESTに限定してpause解除・8gate/今回停止再開の整合を検収し、新規受付を最後に開ける。
8. 少人数5→20→100の順に拡大。必須経路エラー、漏洩疑い、予定外削除、監査欠落、二重処理は1件でも拡大STOP。監視時間/当番は実行可能な範囲で決め、24/7を保証しない。

rollback: 未commitのSQLはROLLBACK。commit済みDDL・匿名参照は安易にdownしない。安全な現schema互換appで停止を保ち前進修正。旧無条件SELECT/GRANT/旧joinを復活させない。Storage/Auth物理削除はapp rollbackで戻らない。

## 操作別停止

退会: 受付遮断と並行してOwner DB pause=true→snapshot/effect/drain確認→env両flagOFF反映→原因修正→同job retry→受付再開。具体SQLと結果不明時のreconcileは専用runbook。
Upload: UPLOADS=falseを配信し、必要なら当該API入口を先に遮断。通常の閲覧は別判断。
forced publish: scheduler停止＋DRAFTS=false。実行済みtransaction/公開物の照合を行う。
RLS: appだけでなく直接DB API境界を止める。広い旧権限へのrollbackはしない。
通報: 受領/証跡を保全し、処理停止時は公開メールへ案内。単独moderationとqueue処理は独立flag。

## 承認可能状態

技術的な差分・検証・手順はレビュー可能。**本番適用の実行承認を満たした状態ではない**。前提差分・全体保守/保全復元・担当/法務・実メール/実機が未確認。ユーザーの一言の承認でこれらをPASSにしない。本番反映は対象/順序/時間/停止・復旧条件を満たしてから別途承認する。

旧節には詳細smoke/保全チェックを保存する。旧flag値・001〜026のみの順序は上記001〜027と最新matrixで置き換えて読む。


<details>
<summary>第48節以前の記録（最新判断は上記を優先）</summary>

# 本番反映runbook（第48節、2026-10-22）

**計画のみ。本番操作は未承認・未実行。** 下記が旧節に優先する。[判定](PRODUCTION_GO_NO_GO.md) / [migration台帳](MIGRATION_ACCEPTANCE_MATRIX.md) / [環境・flag](PRODUCTION_PREFLIGHT.md) / [運営](OPERATIONS_READINESS.md)。

001/005/014/021は権限縮小と追加DDLが同居する。staging適用済みSQLを切り分けたり並べ替えて「追加→app→権限」とはできない。**停止を伴う番号順001→026→互換app→合成smoke→退会を最後に有効化**を採用候補とする。現時点で無停止移行を約束しない。

## 0. 実行台帳と開始条件

運営責任者/実行者/確認者/当番・代理、対象project、候補tree/release ID、予定開始・終了時刻、最大停止時間、連絡先、各phaseの開始/終了/GO判断/証拠IDを私的台帳に記録。秘密値・ユーザー本文は記録しない。実時刻・停止時間はリハーサル後に確定し、空欄のまま実行しない。

- [ ] 001〜026の名前/hash/改行規則を凍結。既存schemaへの適用でstaging baselineを含めない。
- [ ] 別承認の本番カタログ照合: RLS/列ACL/関数署名・所有者/4view/FK/Trigger/default/check/sequenceと過去監査との差分。名前一致だけで適用済みとしない。今回SQL実行なし。
- [ ] 009の既存job有無、019のpending重複/在籍snapshot欠落、023未知Auth FK/列、026 updated_at Triggerを確認する。最小件数/識別情報で運営が確認。失敗回避の無承認削除禁止。
- [ ] Storage bucketのprivate設定、既存policyのanon/auth直接権限、legacy owner/pathと本番署名境界を確認。stagingはStorage policyコピーなし。未知なら退会を止め、閲覧漏洩が疑われるなら一般公開を止める。
- [ ] DB/Auth/Storageを別々に保全し、隔離復元の担当・手順・復旧時間・対象時点を記録。DB backupはStorage実体を含まない。[Supabase公式](https://supabase.com/docs/guides/platform/backups)
- [ ] 過去削除/非表示/tombstoneを復元後に再適用する。Auth再作成や投稿復元を自動で実行しない。Free枠で復旧可能と未検証のまま約束しない。追加課金は本計画に含めない。
- [ ] 窓口/法務・保持/PII対応、メール・実機、停止訓練、最終ユーザー承認5項目を満たす。

この確認のための本番アクセス・バックアップ取得も、今回の依頼では許可されていない。必要な最小手順と対象を確定して承認後に行う。

## Phase A — 停止境界・保全（開始ゲート）

停止対象: signup/Auth新規作成、全app書込、旧RPC/直接REST書込、upload、新署名発行が危険な場合の署名API、期限公開scheduler、cleanup、退会受付/worker。安全性が確認できる既存の閲覧は維持候補だが、005/021切替中の古いclient読取失敗は許容する短い保守時間として案内する。

**現在のflag群のみでこの境界は作れない。** app入口遮断ではSupabase直アクセスを止められない。配信側の既存制御とSupabase側の停止手段を別々に選定し、無料で使える範囲・管理接続の維持・解除順をsynthetic stagingで実演する。具体的な制御がない場合はSTOPし、必要な最小保守変更を別途提案する。広域REVOKEをその場で追加して既読/管理を破壊しない。

外部入口停止→既存worker/cron drain→実行中job/lease確認→Auth新規作成がないことを確認。実行中SDK削除はflag OFFで取消できない。003以前でも古い削除/cron経路が起動しない境界が必要。

smoke: 新規書込がapp/古いURL/直接REST/旧RPC/Storageの各入口で拒否、管理接続は生存、synthetic actorに限定、未処理作業一覧と最大待ち時間を確認。
STOP: 1入口でも書ける、workerが不明、secret/backup未確認、停止時刻超過、戻す候補appが旧脆弱実装だけ。
rollback: DB未変更なら停止を維持し延期。停止解除だけで旧危険公開に戻さない。現本番の既知未修正境界を別問題として残す。

## Phase B — 基盤・書込境界 001〜018

一括db pushを使わず、台帳の順に1ファイルのBEGIN〜COMMITを適用し、成功/失敗とhashを記録。失敗したSQL Editor接続はROLLBACKでtransactionを閉じる。途中で切り出したSQLは使わない。

- B1: 001→004（台帳、membership、job、運営基盤）。毎回object/ACL/Trigger/署名の構造smoke。
- B2: 005→010（read境界、draft/公開、lease、保持、書込停止、限定運営）。旧clientはまだ開放しない。
- B3: 011→018（通報受付/queue、cleanup、like/room atomic、rate、通報認可、参加atomic）。017後にinternal EXECUTE拒否を確認。

中間RPCは後続による置換前のため一般利用者へ開放しない。合成DML smokeは必要な依存が揃った時点だけ。詳細はmigration台帳B。退会受付・finalizeは双方OFF、通常清掃のscheduleも開始しない。
STOP: 予想外schema、当該transaction失敗、未監査ACLの増加、old direct DML許可、運営の任意列更新、受付消失。005後に想定外RPCへservice EXECUTEが残る場合も次へ進めず照合する。
rollback: 未commit分のみROLLBACK。済みDDL/台帳は保持して停止継続、前進修正。005を再実行しない。

## Phase C — Core・client・退会構造 019〜026

019→020→021→022→023→024→025→026を順に適用。旧RPCを閉じる019と旧view/列を閉じる021がapp前提。023 seedとAuth登録Triggerの間に新規Authを入れない。025はmanaged schemaのTriggerで、実行者権限/既存Trigger順が不一致ならSTOP。

smoke: 旧join/Core RPCをanon/auth/service全て拒否、021の本人/公開列＋新view、022の匿名作品snapshot、private actors/worker権限、Auth FK・Storage/Auth guard・026 timestamp整合。private helperをserviceが直接実行できないこと。metadata検査に対象view結果/実ユーザー行を含めない。
STOP: pending重複、既存job矛盾、未知FK/Trigger、Auth/Storage guard欠落、RLS差異、過剰GRANT、公開projectionに機密列。
rollback: 全chainの自動downなし。023以降の匿名参照を旧Auth FKへ戻さない。現schema互換の修正・appで前進復旧する。

## Phase D — app配信と非退会smoke

承認されたrelease snapshotから新互換appを配信。flagはPRODUCTION_PREFLIGHT表の安全な新経路をtrue、**ACCOUNT_REQUESTS/FINALIZEだけfalse**。旧flag fallbackを「安全なOFF」と扱わない。Auth/Storage/cron secretは管理された本番scopeのみ。変更承認時点で値と適用範囲を確認し、ログへ出さない。

選定済み停止境界の内側で、承認されたTEST actorだけに入口を限定して以下を実施。通常ユーザーはまだ開放しない。public-read smokeもTESTの正確なID/usernameで絞り、一覧全件のレスポンスを保存しない。

1. testアドレスでsignup→確認→login→profile→logout/再login。新Auth/actor/profile連携。
2. TEST room作成・重複request再送→roomとcreator各1。
3. TEST Memberで規約/期限公開同意→join、Core申請→Creator承認。旧在籍申請・非Creator承認拒否。
4. 無害本文と小PNGをupload→post、再送1件。使用済み添付署名、未参加/退出/別user path/別room path/不正path拒否。
5. TEST draft保存、競合version拒否。期限公開・snapshot・匿名work/添付・like冪等を確認。
6. TEST report→受領、運営hide/restore、非運営拒否、監査ID確認。pendingの例外経路故障注入はstaging証跡を使い、本番Triggerを壊して再現しない。
7. seenで既読更新、room/works/ランキングが表示可能。通常運営担当がpending以外の通報と監査を限定確認できる手順も確認。

**期限公開smokeの制約**: mvp_publish_due/公開cronは全期限到来roomが対象で、TEST room指定APIではない。smokeのために本番の一括公開RPCを手動実行しない。隔離stagingの冪等性結果を採用し、正式cron再開の対象影響を運営が別途承認後、TEST roomが自然に1回公開されることだけを観測する。既存本番roomを期限変更してテストしない。

STOP: login、room list/create/join/post/upload/sign、Core、work、like、moderation、既読の必須経路失敗。500/制約エラー、二重公開、同一request二重行、漏洩または意図しない実ユーザー操作は1件でもSTOP。
rollback: 現schemaに対応し旧API410/旧RPC閉鎖を維持する既検証appだけへ戻す。候補がなければ停止したまま前進修正。env変更後は再deployment＋実効確認が必要。

## Phase E — security smoke・一般入口の限定開放

TEST A/B/運営の識別子だけを使う。ID列挙、無制限SELECT、実ユーザー相手のnegative testは禁止。

- anon/TEST B→TEST Aのprivate profile列/非公開投稿拒否。public projectionの許容列のみ可。
- room_members direct INSERT/UPDATE（role/owner/last_seen_atを含む）拒否、既読APIの本人更新のみ可。
- foreign attachment/直接Storage取得/未参加・kick/hidden・deleted targetの新署名拒否。
- 旧APIは410（一覧は既存final-route-inventoryと照合）、旧join/Core RPCはanon/auth/serviceで拒否。internal受領/prepare helper拒否。
- 非運営/退会中運営のqueue/hide拒否。退会対象への限定hideだけは現役運営に可。
- 外部停止を部分解除してもDB境界が成立する。全書込の機能flag/secret/Auth redirectが本番用であること。

STOP: unauthorized read/writeが1件でも成功、clientへservice secret、旧API/RPC復活、監査欠落。旧許可へpolicy rollbackして営業継続しない。
成功後まず運営/TESTのみ、次に少人数へ。退会は次phaseまで未受付。

## Phase F — 退会を最後に有効化

前提: 全migration/app/permission/Storage/Auth smoke PASS、8gate staging証跡、窓口/再試行当番、正確な停止入口とdrain手順、未完了job/未知owner/legacy整理、法務/保持方針、backup範囲確認。未解消項目がある場合は有効化しない。

受付とfinalizeを最初はTESTのみに制限。今回のAPI自体にpilot allowlistはないため、Phase Aの実証済み外部制御が必要。REQUESTSだけONにして一般userの保留jobを増やさない。2flagを検収済み設定で配信し、実効状態確認後に合成アカウントだけで実行。

- 未公開Creator/制作中Coreは拒否（Auth/作品不変）。Memberと公開後Creator/Coreは匿名化→保持証明→未使用Storage清掃→Auth削除→completed。
- 共同作品/使用済み添付/他人投稿保持、公開名義固定、プロフィール不可視、旧login/refresh/JWT書込拒否。退会test accountの秘密はログに残さない。
- 本番で故障注入しない。自然な不明結果はjob IDで保留し、Auth 404照合等の既存worker再開に限定。stage直接UPDATEでcompletedへ進めない。

STOP: 8gate不整合、使用済み消去、予定外Auth削除、lease失効時に継続、unknownをcompleted扱い、停止経路が動かない。
rollback: 入口遮断/worker drain/2flag OFF、新規実行を停止して証跡保全。**Auth/Storage物理削除はapp rollbackやdown migrationで復元できない。** 匿名化/名義変更も単純逆UPDATEしない。同じjobの検証済み前進再開か個別の別承認復旧。

## Phase G — 24時間監視と段階公開

最初は5人→問題なければ20人→100人。100人同時負荷保証ではない。各拡大でerrors/queue/deletion/Storage/rateを当番が確認し、初日24時間の担当/代理を割り当てる。自動通知は未構築なので手動観測間隔を守る。条件と閾値はOPERATIONS_READINESS参照。

## TESTデータと清掃

TEST-PREFLIGHT-日付-短いrunIDをroom/title/無害本文に明記。メールは担当者が所有するtest専用、実名/住所/実写真/作品転載なし。公開に残っても問題ない内容だけ。必要な最小actor数、作成ID、用途、cleanup対象、保持例外を私的台帳に記録。

先にcleanup可否を決める。公開作品/使用済み添付をprefix一括削除しない。論理非表示/削除と実体消去を区別し、共同履歴の検収用保持は期限を設定する。本番承認前にtest user/dataを作らない。

## 障害時の共通判断

- SQL未commit: transaction ROLLBACK。済みmigration: 記録維持し停止、前進修正。
- app: schema互換・旧unsafe経路を戻さない候補だけrollback。なければ停止継続。
- policy/GRANT/RPC: 直前定義へ自動一括復元しない。狭い拒否境界を保った追補のみ別レビュー。
- flag: 安全停止を行うflagのみ操作。room/join/like/intake/drafts/DB_GUARDSのOFFを事故回避に使わない。
- Auth/Storage/不可逆名義: down不可。保全済み情報からの復旧も別判断。backupに対象があると推定しない。

## 利用者への保守案内案

「安全性向上のため、［日時・終了予定］に新規登録、ルーム作成・参加・投稿・添付・退会などの更新操作を一時停止します。閲覧も一時的に利用できない場合があります。完了後に画面を再読み込みしてください。お問い合わせ：［確定した窓口］」

実日時/担当/連絡先・停止範囲の確認後に採用。今回は通知・配信なし。既存UIには統一保守表示がないため、案内とAPI拒否を実装済みとは扱わない。


<details>
<summary>旧フェーズの履歴（実行には上記第48節だけを使用）</summary>

# 第47節追補（2026-10-22、実行は本番承認後のみ）
以下が旧節より優先。本番変更・deploy・commit・pushは今回実行していない。
現在の最終判定はFINAL_P1_ACCEPTANCE.mdを参照。

1. 対象project/backup/復元範囲/既存job/未知FK/Storage所有者を承認済み手順で事前照合。旧公開PIIは自動全件公開継続せず、公開審査フラグ・運営非表示を適用する。本文を一括ログ出力しない。
2. signupを含む書込・公開cron・cleanup・退会workerを停止。配信だけでなく直接REST/旧RPCも停止境界を実証する。023 seed〜Auth登録Triggerの間に新規Auth作成を入れない。
3. 既存基礎schemaとの照合後、001→026を番号順・1transactionずつ適用し各smoke。staging用baseline/環境markerを本番へ適用しない。適用済みSQLを編集/一括再実行しない。
4. 019 Core原子処理、020匿名化前提、021最小client読取、022公開snapshot、023匿名主体/FK、024限定prepare、025late upload/Auth最終guard、026Core履歴timestamp互換の順。各hashを台帳記録。
5. 互換appをdeployし、本番用テストアカウントで通常フロー/拒否/運営/同時処理をsmoke。退会2flagはまだfalse。
6. 023〜026の保持とSDK故障注入結果・実環境設定を照合後、退会を最後に有効化。最初は少人数。受付とfinalizeは別flag。CRON_SECRETは秘密管理しログに出さない。
7. 処理中断のjobは本人再送か、認証された運営がPOST /api/cron/account-deletionへrequestIdだけ送って再開。Auth不在の途中jobもworkerで完了照合。稼働開始前に未完了jobを日次確認する当番・再実行手順を割当。自動schedulerは今回追加していない。
8. 5→20→100人と段階拡大。権限逸脱/予定外削除/監査欠落は1件でも停止。Auth/Storageは不可逆なのでdownではなく同じjobから前進復旧。旧unsafe APIや広域GRANTを戻さない。

## 023〜026の適用・停止基準
- 023: private actor登録、既存Auth FKをRESTRICT保持主体へ。Auth/profileと履歴を切り離す。匿名参照作成後の単純down禁止。
- 024: 同一job/leaseと完全一致row capabilityのみ許可。Storage不明/未知FK/Trigger予想外変更はAuthを残して停止。
- 025: unused隔離後の遅延upload拒否、未準備Auth削除拒否。Storage API以外でobjectsを削除しない。
- 026: 監査済みset_updated_at()のnow()だけを期待値へ追加。比較列を緩めない。
- 各migrationのtransaction失敗はrollback。成功後はworker停止→metadata照合→追補修正。Auth再作成や他人作品の削除を自動復旧に使わない。

---

# 段階反映・復旧runbook（第42節）
2026-10-21。実行準備用。現在NO-GO。本番操作・commit/push/deployは未承認・未実行。
正本: MIGRATION_ACCEPTANCE_MATRIX.md、STAGING_ACCEPTANCE_PLAN.md、PRODUCTION_GO_NO_GO.md。
001〜017は元SQLを変更せずレビュー、018のみ追加。app/DBの単独rollbackは互換性を保証しない。

## Before
1. staging識別・合成専用確認、schema/関数/Trigger/列GRANT/Storage policy/Auth設定/migration履歴を照合。全SQLhashとapp候補を凍結する。
2. backupの対象（DBとStorageは別）・復元所要時間・復元後tombstone再適用をstagingで試験。Auth userの復元も別契約として検証し、DBbackupに含まれると推定しない。
3. 運営当番/代理と停止・復旧責任者、実窓口を確定。誤公開/認可違反時の優先停止経路を用意。
4. 旧client/旧cron/直接RESTを含めたメンテナンス境界を検収。現アプリに全機能を一括停止する完成済みswitchはないため、配信基盤の認証/保守ページだけでDB直接アクセスも止まるとは扱わない。未確立なら適用しない。
5. envはキーと値の適否を管理画面で確認、ログへ秘密値を出さない。新flagはfalseのまま。旧API停止版と新コードの全依存がbuild済み。
6. staging全フロー・実機・負荷・復旧、P1=0、保持/法務/窓口がPASSになってからproduction対象manifestと停止時間を提示して最終承認。

## フェーズ分割の制約
001はposts権限剥奪、005は閲覧/列DML/旧RPCの一括制限、014はlike DML剥奪が新schemaと同居する。
そのため「全schema追加→app→最後に全権限縮小」という純粋なexpand/contract順は現ファイルには存在しない。SQLを途中切取りして適用したり番号を飛ばさない。
以下はmaintenance内で境界ごとに検収する案。全てstagingで先にリハーサルする。一括db pushは禁止。

## Phase A: 停止境界と互換app
apply: 公開募集/書込/公開cron/清掃/Auth workerを停止。安全停止版と新経路を含む互換appを配信。flag依存をまだ有効にしない。
smoke: 旧join/core/debugが410、退会未受付、未認証書込拒否、秘密非露出。直接REST/旧RPCも検収用actorで到達境界確認。
Go: maintenanceが実際に機能すること。No-Go: 旧unsafe write経路が動く。
rollback: 既存の安全停止版へ。危険な旧join/path経路へ戻さない。外部停止機構の手順未確立ならBLOCKED。

## Phase B: 基盤001〜004
apply: 001→smoke→002→smoke→003→smoke→004→smoke。DDL権限は運営管理経路のみ。
smoke: 添付台帳消費/所有権、Core/kick/creator、job CAS、運営認可/監査。003受付flagはfalse。
Go: 旧直接投稿を拒否し新RPCでfixtureのみ動く。No-Go: Trigger/列/制約不一致、他人path受理。
rollback: 失敗transactionはrollback。成功分台帳/job/監査を保持して機能停止、前進修正。旧posts DML権限を戻さない。

## Phase C: 読取境界005と作品006
apply: 005→role/view/署名smoke→006→draft/公開smoke。
smoke: anon/authの招待列拒否、4viewのinvoker/人数、参加中本文、非参加/退出/hidden/deleted拒否、審査済みlogのみ公開、旧作品添付継続。
Go: projection修正とDBが一致し、既存旧RPCのEXECUTE剥奪で正規UIを壊さない。No-Go: 未承認全文露出/一覧停止。
rollback: 公開/読取の問題箇所を停止。旧true policyやpublic definer GRANTへ戻さない。関数・policy修正は適用前スナップショットとの差分を署名単位でレビューし前進適用。
005を017以後へ再適用するとinternalへservice EXECUTEが戻り得る。禁止。

## Phase D: 退会基盤・通報007〜012
apply: 007→008→009→010→011→012、各番号で限定smoke。
smoke: 009前job0・必須11表、退会時名義/停止、運営一回許可と監査、旧Trigger失敗してもreceipt保持、一般role運営拒否。
Go: 保持/削除worker未接続、受付無効のまま新運営系が動く。No-Go: 無関係の更新/監査欠損/既読等に意図しない停止。
rollback: 受付/運営対象機能停止、job/receipt保持。009 guardを全解除しない。Auth/Storage削除をここで実行しない。

## Phase E: 013〜018とapp切替
apply: 013→014→015→016→017→018、各smoke。013workerは起動しない。
smoke: unusedだけclaim、like intent/再送、room+creator原子性、rate、通報認可/internal拒否、Member45/重複/既存role維持。
Go: app/DBと下記flag依存が一致、staging E2E合格。No-Go: APIfallbackで旧DMLへ戻る、500増加、同意欠落、人数超過。
rollback: 失敗機能を停止。flag falseにするだけでは旧処理へ戻り得るため、互換の停止版で止める。新記録は保持。migration018未適用のappはflagfalseで起動できるが公開安全性の保証ではない。

## Flag検収依存
- MVP_DB_GUARDS_ENABLED: 001/016とupload/post/全rate対応。
- MVP_MEMBERSHIP_GUARDS_ENABLED: 002/009/018、既存参加/Core RPC/同意の原子性を別検収。
- MVP_ATOMIC_JOIN_ENABLED: 018＋新join-supporter API。同意版2026-03-24とUIを一致させる。将来同意改定時はSQLとUI両方更新。
- MVP_DRAFTS_ENABLED: 005/006と公開log審査・署名・cron。
- MVP_LIKE_REQUESTS_ENABLED: 014と新LikeButton。
- MVP_ROOM_CREATION_ENABLED: 015と新作成UI。
- MVP_MODERATION_ENABLED / MVP_REPORT_INTAKE_ENABLED / MVP_REPORT_QUEUE_ENABLED: 010〜012/016/017＋運営担当/当番。直接service操作と内部RPCも拒否検収。
- MVP_ACCOUNT_ATTRIBUTION_ENABLED: 009と退会名義表示。
- MVP_ACCOUNT_REQUESTS_ENABLED: 全退会設計/実worker/実Auth/Storage検収が揃うまでfalse。今回有効化禁止。
同じflagfalseでも安全停止と旧fallbackは別。依存が不足する場合は切替せず停止する。

## Phase F: 外部清掃・旧経路整理
旧endpointは既に410を維持。未使用schemaやreceiptを削除しない。清掃は013/TTL/Storage保持を検収し、件数制限付きで別承認後のみ起動。
Auth削除は退会専用の全検収が必要。Storage object/Auth user/data物理削除はrollback不能になり得る。DB rollbackで戻ると説明しない。

## After
test accountでsignup/確認/login→room作成→参加/Core同意→upload/post→公開/作品→like→report→運営対応。非参加/退出/hiddenの拒否も同時確認。
退会は無効/未受付表示を確認（無効のまま一般募集をGOにしない）。明示受付を提供する場合は全削除検収を通す。
小規模招待を段階化し、error/429/p95/通報滞留/容量を担当者が観察。100人へ一気に開かない。

## 停止/rollback条件
login/作成/join/post/添付閲覧/運営の不能、公開重複、RLS越権、予定外削除、署名漏れ、監査欠損で即停止。
5xx>1%または通常遅延の継続悪化（5分）でも拡大停止。認可違反は件数1でも停止。
appだけの不具合: 互換安全停止版へ戻す。DB互換不具合: 対象機能停止→既存定義/ログ比較→最小forward fix。policy/function rollbackも危険な広域許可を復活させない。
外部削除: 既存backup/権利/整合を確認し個別復旧。自動Auth再作成、全DB巻戻し、他人の作品所有付替えをしない。

## 将来承認後のコマンド例（今回実行禁止）
実行前に別staging/prodの識別とmanifestの照合が必要。connection情報は秘密管理経路で設定し表示しない。
```powershell
# 対象を明示する接続プロファイルPGSERVICEを操作者が選択・二重確認
# psqlはエラー時停止。ファイル自身がBEGIN/COMMITを持つ。
psql -X -v ON_ERROR_STOP=1 --file supabase/migrations/202610210001_attachment_ledger.sql
# 各番号を1本ずつ明示し、smoke結果を記録してから次へ。
# 全pendingを送る supabase db push はこのrunbookでは使わない。
npm run test:security
npx tsc --noEmit --incremental false
git diff --check
# 最終承認後だけ、承認manifestにあるpathを明示
git add -- <reviewed-paths>
git commit -m "<approved-message>"
git push origin security/fix-storage-sign
```
Vercel: linked project/environmentを管理画面で確認→staging用Preview（test envのみ）→smoke→候補SHA固定→production承認→承認候補を反映→After。Previewでもproduction envを流用しない。
CLI未導入/接続識別なしの現状では上記を実行しない。Vercel productionコマンドを自動化していない。


## 第43節: staging対象確定後の追記
stagingはfwqucffxdmbdczspkcyr、Free/NANO/Sydney。production joedeuyrzimqyjapqpyhとは別。初回空監査成功、合成Auth/Storage17件成功。
001〜018は全てstaging未適用。新規Supabaseにはアプリ基礎schemaがなく、001より前のbaseline bootstrapが必須。既存メタデータはDEFAULT/CHECK/enum/関数本文等不足、追加読み取り監査を承認待ち。
追加bootstrapを検証するまではPhase Bへ進めない。基礎Auth/Storage成功をmigration/RLS/退会PASSへ転記しない。適用順・停止/rollback・app依存は従来通り、全段階リハーサル未完。

## 第44節: staging実行証跡
baseline→001〜018をstagingに個別transaction・段階確認で適用済み。009/011は監査不一致修正後のhashで適用。第42節の『001〜017変更なし』は過去状態。staging-schema-plan.jsonを今回hash、staging-applied.jsonを実行証跡とする。
各段階新表smoke/18本成功。実RPC22検査成功。基礎schemaは元client ACLを再現せず閉鎖、Storagepolicyは未コピー、sequence上限は型既定値。productionへこのbootstrapを適用しない。新規staging専用guardで既存public表ありなら停止する。
以後適用済みSQLの再実行は禁止。変更は追補migrationとして検証する。旧Core安全化/必要な閲覧権限/全app・保持・復旧検収が未完のため、本番反映可能とは判定しない。


## 第45節: 最終staging検収の結果（2026-10-21）
NO-GO。最新の詳細はFINAL_STAGING_ACCEPTANCE.md（指定19項目）。
019 Core原子承認/旧RPC revoke、020未公開Creator退会拒否/固定匿名名/プロフィールPII除去をstagingへ適用。001〜018は今回不変。旧先着/招待Core API410、UI停止、新RPC引数照合。ルーム作成は承認制既定ON、招待無効。
855チェック成功: offline697、監査schema local39、native31、実staging45、Web8、匿名responsive35。弱点再現/失敗画面layoutを含むため全機能成功ではない。型/対象lint/build/diff成功、ローカルサーバー終了。
Core最終在籍は退出/追放後inactiveだが、先にcommitした昇格履歴は残り得る。deadlock被害側の再試行を実施。厳密な退出優先とAPI原子化は残る。
退会前提と匿名化7件成功、Auth削除/FK/CASCADE/events所有権/Storage連動は未完成でUI/API既定無効。既存jobのPII補正も未実装。保持方針の承認待ちではなく技術実装の不足。
実authenticated RESTでprofiles/room_members/rooms_with_counts_v2が42501、全Web E2Eはblocked。実UI login/invalid password/reloadとprofile5幅のみ成功。
実staging期限公開同時RPC・再実行・1作品保持成功。HTTP cronから作品/添付UIまで未検収。通報保留/限定運営は最新条件で再検証成功。
未解決P1群3以上: Auth削除整合性、本番広い権限/旧経路（未反映）、既存公開PII/保持検収。総合NO-GOを維持。
次: client最小権限/同意保存→退会履歴FK/Storage→Core退出競合→全Web/復旧/実機。追加ローカル作業の再承認不要。
USER ACTION REQUIRED: 実確認メール受信、運営窓口/当番・法務/実機担当。本番反映承認は全検収後だけ。
branch security/fix-storage-sign、既存全差分/削除2件保持。sources変更なし。本番アクセス/変更・commit/push/deploy/merge/reset/clean/stashなし。


## 第46節: 021/022を含む反映候補順（未承認・実行禁止）
1. Preflight: schema/role/column grants/view dependencies/既存job/旧RPCを再照合。productionデータの取得は別承認。manifestのproject ref、対象SHA、機能flagを固定。
2. Backup: DB/Storage/Authの復元範囲と不可逆操作を分離し、隔離先でrestore演習。バックアップがあるだけでは通過しない。
3. Additive schema: 必須001〜020と将来の退会保持移行を互換段階で準備。staging baseline bootstrapは禁止。migrationの既存job停止条件を無視しない。
4. DB smoke: service RPC、RLS、旧経路の攻撃検査。途中に旧RPCが再許可されるwindowを作らず、メンテナンス境界内でまとめて完了する。
5. App deploy: mvp_room_list/本人同意RPCを使うappは021が必要。段階適用中は機能を止め、旧appへ広いDMLを再許可して互換性を作らない。
6. App smoke: login/own profile/room create/join/seen/Core/draft。
7. Permission tightening: 021→022。stagingで成功した順序。関数EXECUTE/列grant/legacy view revoke/公開draft境界を確認する。
8. Public smoke: 匿名一覧/作品/添付、hidden/deleted拒否、内部列とmembership列挙拒否。
9. Old route/RPC disable: 019等の最終ACLを再確認。旧Core/join停止を戻すapp rollbackは禁止。
10. Account deletion enable: 現在は不可。FK/Storage/Auth/retry/privacy/Creatorの全実検証成功と既存job補正後に限る。未完成receiptを強制trueにしない。
11. Final smoke: 実確認メール、認証後全flow、運営通報、Storage保持/清掃、退会故障注入/再開、復旧・負荷・実機。
12. Monitoring: エラー率、cron遅延、通報滞留、退会needs_review、cleanup lease滞留を運営担当と監視。
021 rollback: 該当UIを停止し、限定REVOKE/前進修正。旧viewやprofile/member UPDATEの再公開は禁止。
022 rollback: draft表示停止/限定REVOKE/前進修正。旧policyへ戻すと匿名読取が壊れるため自動downしない。
実適用済み001〜022は改変/再適用せず、修正は023以降。最終退会migrationはまだ存在しないため、本番順序は実行承認可能な完成版ではない。

</details>

</details>

</details>

</details>
