# Buffer接続確認（2026-10-22）

## 完了した設定
- Buffer登録・メール認証・X @minnade_tsukuru 接続をブラウザーで確認。
- Personal Key minntuku-x-automation、期限2027-01-20、権限3件を確認。秘密値は取得していない。
- Vercel sonetokiyas-projects/minnade-tsukuru の BUFFER_API_KEY が Secret / Production として保存済み。実値は取得していない。
- 接続先channel IDはBuffer画面で確認した 6ad9a93b778b240e2f8816f0。

## ローカル実装
POST /api/integrations/buffer/check。Authorization: Bearer（既存CRON_SECRET）必須。
サーバー環境変数のBUFFER_API_KEYをBuffer公式APIへのヘッダーにだけ使用する。
固定チャンネルのid/name/service/isDisconnected/isLocked/isQueuePausedのみを問い合わせ、
応答はokと固定codeだけ。本文・DM・他アカウント・秘密値は返さない。
10秒timeout、redirect拒否、no-store、GraphQLエラー・部分成功・型不整合を失敗にする。
投稿mutation、cron登録、DB変更は含まない。

## 検証
docs/buffer-connection-check.cjs は合成認証値・モックfetchだけで25ケースを検証。
実APIの成功とは区別する。Bufferの外部API疎通はまだ未確認。

## 次の実行条件
更新: 本体は第52節で本番反映・検収完了。5〜10人β GO、24時間監視中。18:55 JST記録では異常0。
この追加のみを理由に本番再デプロイしない。
リリース条件成立後、承認された配信に本routeを含め、Productionの新deploymentで
既存CRON_SECRETを安全な実行環境から送信してPOSTする。秘密値をチャット・ログへ出さない。
BUFFER_CONNECTEDなら読み取り接続確認成功。投稿権限の実動作確認は別工程。
Vercel環境変数は保存だけでは既存deploymentに反映されない（UIでも確認）。

## 自動投稿の接続は未実装・未稼働
次工程は永続キュー、排他/再試行/重複防止、送信直前の公開・通報・PII・Creator除外確認、
日本時間の1日上限2件と通常夜1件、完成作品優先、新規ルーム日1件、
締切イベント失効、週次まとめ。未知の送信結果は無条件再送しない。
公開除外や検査結果をDBにどう保存するかを確定してからイベントを接続する。
重要告知の自動生成・送信は含めない。

## 公式API根拠
- https://developers.buffer.com/guides/getting-started.html
- https://developers.buffer.com/guides/rest-migration.html
- https://developers.buffer.com/types/Channel.html


## 2026-10-22追加: 非送信プランナー
lib/buffer/promotionPlanner.tsを追加。DB・ネットワークを利用しない純粋な投稿計画処理。
- 日本時間12:00/20:30。候補1件なら夜。1日最大2件、新規ルーム最大1件。
- 完成→新規→締切→日曜週次の順。期限切れ、満席、公開不可、通報対応中、Creator除外、未レビュー、PII懸念は除外。
- イベントID/種別＋対象IDで重複除外。reserved/sent/uncertainは再送除外・日次枠消費。
- 安全性のフラグは明示値必須。5分超の古い状態は拒否。タイトル中のURL/制御文字を拒否、公式ホストへのリンクのみ生成。
- 純粋関数の計画は予約でも送信許可でもない。全履歴を渡す信頼済みadapter、永続キューの原子的予約、送信直前の再判定は次工程。
- PII正規表現は完全検出ではない。レビュー済み・PII確認済みを別途必須にしている。
- 昼しか有効でない締切候補は保守的に見送り。夜の候補が成立しない場合、昼だけの臨時募集はしない。

検証: docs/buffer-planner-check.cjs 47件＋既存接続確認25件成功。型チェック・追加2ファイルlint成功。
テストはすべて合成入力、実API疎通/送信/DB連携成功を意味しない。commit/push/deploy/実投稿/本番設定変更なし。
残作業は公開前検収待ちではなく、永続キュー・イベントadapter・Creator除外保存先・送信workerの実装と接続検収。

## 2026-10-22: 永続キューと送信worker（この節が最新）
状態: feature/buffer-queue-send のローカル実装。**本番未変更・029未適用・送信未実施・自動化OFF**。
上の「未実装」は旧時点。実API検収と配信承認は依然未完了。

### 構成・既存本番への影響
- 追加migration supabase/migrations/202610220029_buffer_queue.sql。既存001〜028、既存表/trigger/公開cronは変更しない。
- buffer_reviews: room単位の掲載許可・公開除外・PII確認・レビュー対象hash。初期は除外。title＋draft blocksが変わると再レビュー必須。
- buffer_queue: queued → sending → succeeded / failed / unknown / cancelled。succeededは**Buffer予約受付**でありX公開完了ではない。
- event IDの主キーとkind:targetのUNIQUE、JST昼夜のslot UNIQUE、transaction advisory lockで原子的に予約。取消・失敗・不明も重複キーと日次枠を保持する保守的運用。
- claimはtokenでfencing、2分超のsendingはunknown。失効slotは取消。本文再生成が一致しない場合も取消。
- anon/authenticatedは新規表とRPCを使用不可。service_roleも表を直接操作できず、worker用4 RPCだけ許可。reviewは別途承認済み運営DBセッションで記録する。利用者から候補・安全フラグ・本文を受け取るAPIは作らない。
- DB adapterはroom/draft/member/report/deletionを読取り、未レビュー/非表示/削除/成人/退会処理/未解決通報/掲載除外/PII未確認を除外。旧reportsに残る通報は解決状態の確実な契約がないので除外継続。
- 完成作品の候補期間は公開後7日、新規募集は開始後2日。完成→新規→締切→日曜週次、通常夜1件/最大2件、新規日1件、残席は既存supporter枠45を使用。週次集計は掲載許可済みの公開対象だけが母集団。
- lib/buffer/sender.ts: 固定公式チャンネルを事前照合、公式GraphQL createPost/customScheduledのみ。shareNowなし。秘密は環境変数→Authorizationのみ。成功時はID/時刻、失敗時は固定分類のみ保存。
- 10秒timeout/部分成功/不正JSON/429/5xx/応答消失はunknown、再送しない。送信前のチャンネル照合失敗のみ2分間隔・最大3attemptでretry。認証拒否/明示mutation失敗も自動retryしない。
- 成功後のDB記録失敗はsendingのまま→unknown。次の呼出しでmutationを繰り返さない。

### 実行入口・dry-run・定期実行
GET /api/cron/buffer。Authorization: Bearer が必要。専用BUFFER_CRON_SECRETがあればそれを使用、なければ既存CRON_SECRET（Vercel Cron互換）を使用する。
すべてno-store。認証後も候補本文・token・API応答は返さず集計/固定codeのみ。
?dryRun=1 は環境が送信モードでも必ずread-onlyに下げる。query/bodyで送信モードへ昇格できない。

環境変数（値をチャットへ貼らない）:
- BUFFER_RUN_MODE: 未設定はdry-run。dry-run / enqueue / canary / automatic。
- BUFFER_API_KEY: 既存安全なSecretに保存。今回ローカルでは未設定を真偽のみで確認。Production保存済みという前回記録はあるが、今回取得・疎通・変更していない。
- BUFFER_CANARY_EVENT_ID: canaryで許可する安定event IDを1件だけ指定。繰り返し実行しても他候補は送らない。
- BUFFER_CANARY_ACCEPTED=true: Xで1件の公開を本人が検収した後だけ設定するautomaticの追加ゲート。
- DB接続は既存Supabase環境を利用。専用migrationがなければ503で停止する。dry-runでもDBにmigration/reviewがなければ実データ検証は完了しない。

dry-runはsnapshot RPCだけを呼び、候補生成→仮queue計画→直前安全性判定まで確認。queue/review/既存業務表/Bufferには書かない。Buffer通信も行わない。
定期実行の入口は実装済み。**vercel.jsonは変更せず、まだ登録しない**。承認済みの配信時に既存公開cronを保持して以下だけ追記する構成案:
- path /api/cron/buffer, schedule */5 2,11 * * *（UTC。JST 11時台/20時台）。
- 予約送信はdueAtの15〜2分前だけ取得。通常夜20:30、2件時は12:00/20:30。取得後は1分未満なら送信しない。
- cron提供プランの実行頻度制限を事前確認。利用できない場合は同じ認証付きGETを安全な外部schedulerから呼ぶ。PC常駐に依存する必須処理にはしない。
- 初期配信はdry-run、canaryは選択1件のみ。automaticの有効化は別承認・実投稿検収後。
- cronの重複・遅延はSQLで抑止。遅れたslotを翌日へずらす処理はない。

### レビュー台帳の運用
公開済みだからSNS転載可と推測しない。運営がCreatorの掲載意思、紹介タイトル、リンク先の公開内容とPIIを確認した後、承認されたDB管理セッションで対象roomだけ設定する。
以下は**手順の例、今回未実行**。hashは確認した内容のものを使い、確認と更新の間の変更を防ぐため同一transactionで対象room/draftをlockし照合する。
- excluded=false、pii_clear=true、reviewed_atを記録、reviewed_hashはbuffer_source_hash(room_id)に一致させる。
- 除外希望を受けたらexcluded=true。既にBufferへ予約済みのものはBuffer側でも直ちに取消する。
- 管理SQLの実行権限を一般利用者/service_roleへ広げない。Creator用設定UIはこの変更に含まれない。

### 不明結果・限界
unknownは自動解除しない。運営がBufferの固定チャンネル・本文・予約時刻・IDを照合し、存在する場合だけ管理者が成功記録へ整合させる。不存在を推測してqueue行を削除/再作成しない。履歴/UNIQUEは保持する。
安全性の再判定は**Bufferへ送る直前**。DBと外部APIにまたがる完全な原子性はない。送信後〜X公開までの公開変更/満席/通報はこのworkerだけでは自動取消できないため、予約後の除外変更は運営のBuffer取消が必要。送信窓を最大15分に制限したが、この残余リスクはゼロにはならない。
本番適用前にstagingで既存001〜028との統合・実PostgREST ACL・運営レビュー手順を検収すること。今回のDB検証は既存参照列を再現した合成schemaであり、実staging検収とは区別する。

### 今回の検証
- 既存プランナー47＋接続25、追加queue/worker/API58、route認証/ゲート11 = **141件**。
- 追加DB検証は127.0.0.1の一時native PostgreSQL・合成データ。8接続の同時予約/claim、6接続の日次cap、接続を閉じて再接続後の永続行を確認。テスト時計のみ固定、業務SQLはmigration候補を使用。
- dry-run合成: 候補2（完成＋週次候補）、計画1、送信前適格1、DB書込0、外部送信0。実本番データdry-runは未実施。
- 実API接続/Buffer予約/X投稿は未検証。API key未設定のローカルで実送信を試していない。
- 実行: BUFFER_TEST_RUNTIMEに既存pg＋embedded-postgresの検証runtimeディレクトリを設定して npm run test:buffer。秘密値は不要。
- 公式仕様: https://developers.buffer.com/guides/posts-and-scheduling.html 、https://developers.buffer.com/types/CreatePostInput.html 、https://developers.buffer.com/types/ShareMode.html 。

### 本人による次の操作（順序厳守）
1. staging適用・検収の実施を承認し、掲載許可とPII確認を行う対象1件を選ぶ。秘密値は既存の安全な環境設定画面だけで保存する。
2. 実データdry-runの結果確認後、Buffer予約1件を明示承認する。予約は時間が来るとXに公開されるため、公開予定時刻も確認する。
3. Xでその1件を確認し、結果を報告する。完全自動化はこの後の別承認で有効化する。

### 最終検証結果
最終コードで npm run test:buffer 141件PASS、npx tsc --noEmit PASS、追加TS/CJSのeslint PASS（0error/0warning）、git diff --check PASS。
外部通信遮断・接続値placeholderによる npm run build（webpack）PASS。既存middleware→proxyの非推奨警告あり。全体lintは今回未実行。
既存vercel.json、公開cron、package-lock不変。branch feature/buffer-queue-send、HEAD a325926、今回の追加commitなし（既存差分含め作業ツリーに保持）。
本番変更/DB適用/実API送信/cron登録/push/merge/deployは全て無し。

## 2026-10-22 staging実環境検収（最新）
最新添付dd4dd8b9に基づき、staging DB適用・TEST1件のBuffer予約/X公開までを実施する。production接続/変更、push/merge/deploy、通常自動送信ONは禁止を維持。

- staging: minnade-tsukuru-staging / fwqucffxdmbdczspkcyr。Dashboard上でproject名・refを照合。UIのmain PRODUCTION表示はこのstagingプロジェクト内のbranch表示であり、実本番joedeuyrzimqyjapqpyhには接続していない。
- 029適用前: buffer表0、buffer関数0。029/030をstaging SQL Editorから適用し成功。hashはbuffer-staging-migrations.jsonへ記録。既存001〜028は変更しない。
- 追補030: scheduled/sentの区別、sent_at/external_id/external_url、Buffer読み戻し照合、TEST1件の管理者専用許可台帳。service_roleは台帳を変更できない。
- TEST専用の短時間予約は通常昼夜のプランナーから分離。固定本文・TEST Bufferで始まるレビュー済み完成作品・許可台帳の1イベント/時刻に限定。通常の投稿頻度・優先順位は不変。実行入口はローカル専用で、cronから呼ばない。
- scripts/buffer/staging-context.cjsは.env.staging.localだけを読み、staging refを完全一致で固定。production envを流用しない。実行結果は値を伏せた固定分類/非秘密receiptのみ。
- 本人がlocalhostの一回限りのpassword入力画面でBUFFER_API_KEYを保存。モデル/チャット/ログへの値表示なし、Git除外確認済み。入力サーバーは終了済み。BUFFER_RUN_MODEは未設定=OFF/dry-runのまま。
- Buffer read-only preflight PASS。固定channelとtwitter/minnade_tsukuru、接続/lock/pauseを照合。画面もQueue0/Sent0を確認後に開始。

### 実DB・dry-run結果
既存staging19roomは変更せず、既存の有効なsynthetic actorを用いて専用TEST4roomを作成。個人データ/production作品を使用しない。fixture IDはbuffer-staging-fixture.json。
実PostgREST13検査PASS: eligible/excluded、実候補の優先順位、dry-run不変、8並列enqueue/claim、duplicate、fencing、failed/backoff、anon拒否、service direct-table拒否。
実DB transaction11検査PASS: retry→unknown、unknown再取得/再投入拒否、中断unknown、予約受付→scheduled→sentと公開情報、直前除外、日次cap。すべてROLLBACKし、検査で作った架空の公開receiptは保存していない。ACL/RLS/trigger一括確認PASS。新規3表RLS、一般role/RPC拒否、service role直接変更拒否、業務trigger追加0。
通常dry-runは実staging候補5、当日昼夜slot経過のため新規計画0、書込0/送信0。優先順位の比較だけ実候補に翌日の計画時計を与えて検証した点は区別する。
実予約対象のcanary dry-runはeligible=true、existing=false、書込0/送信0。実行時の現在時刻・実stagingデータで確認。
DB検収用queueはBufferへ送っていない。検収後cancelledにし、他TEST候補も公開除外へ戻した。

### 予約1件（確認済み）
10/22 23:07 JST指定、23:01 JSTにBuffer受付成功。Buffer ID 6ada172de8cca8cdcc55b722、attempts=1。
イベント completed_9d8341d7-d03f-44ae-9426-1cbe6dcdecb4。
本文は「【TEST】みんつく Buffer/X連携の動作確認です。作品の公開・参加募集ではありません。」、リンク先は公式Xアカウント自身。staging作品の存在しないproduction URLを投稿しない。
API読み戻しで本文・channel・予定時刻が完全一致し、DBはscheduled。Buffer画面もQueue1/Sent0/23:07 JSTの1件を確認。
同じイベントの再enqueueは追加0。予約後にTEST許可をenabled=falseへ戻し、追加送信を停止。通常自動送信はOFF。
X公開結果は以下の追記を参照。

### 検証・注意点
ローカル回帰159件（47 planner＋25接続＋76 queue/nativeDB/receipt＋11 route）PASS。実stagingは13 API＋11 transaction＋1 ACL/RLS/triggerの25群PASS。
最終typecheck・対象lint・通信遮断webpack build・git diff --check PASS。既存middleware非推奨警告のみ。
本番の自動運用承認は含まない。Buffer予約後の除外変更は手動取消が必要。実X配信後の照合は今回のローカルreconcile操作で、常時監視cronやwebhookはまだ接続しない。
手順: node scripts/buffer/staging-run.cjs dry-run / canary-dry-run / check / reserve-one / reconcile。reserve-oneは許可台帳がenabledでない限り失敗し、送信済みイベントを再送しない。


## Buffer staging・X公開検収完了（2026-10-22 23:12 JST、最新）
Status: done（今回のstaging統合検収・TEST予約/公開1件）。自動運用の本番導入は未実施。
staging fwqucffxdmbdczspkcyr に029/030適用。実DB検収25群PASS（API13・SQL状態遷移11・ACL/RLS/trigger集約1）。実データdry-runは書込0/送信0、固定TEST canaryは適格1件。通常時間枠を過ぎた通常plannerは0件で正常。
Buffer API接続PASS。TESTを1件のみ予約し、2026-10-22 23:07:07 JSTに公式 @minnade_tsukuru で公開。Buffer Sent1/Queue0、本文・投稿者・時刻をX画面でも確認。
公開URL: https://x.com/minnade_tsukuru/status/2113270930105409955
Buffer ID: 6ada172de8cca8cdcc55b722。DB state=sent、attempts=1、sent_at・external_id・external_url保存済み。予約後の同一event再投入0件を確認済み。追加TEST許可false、自動送信OFF、cron未登録。
APIの公開リンクは数値アカウントID形式だったため初回照合unknown。再送せずX画面で公式アカウントへのリダイレクトを照合し、確認済み固定IDだけユーザー名URLへ正規化する修正と他ID拒否テストを追加。読取再照合でsentへ収束。
最終検証: planner47 + connection25 + route11 + queue/nativePG78 = 161 PASS。typecheck・対象lint・外部通信遮断build PASS（既存middleware非推奨警告のみ）。全体lint・既存MVP全試験は再実行していない。
追加変更: migration030、testCanary、sender.inspect、scripts/bufferのstaging専用runner/SQL/秘密登録補助、公開結果JSON。秘密はGit除外の.env.staging.localのみ、出力/commitなし。
本番app/DB/設定変更・push/merge/deployなし。承認済みX TEST投稿1件のみ外部公開。並行監視の差分は保持。feature/buffer-queue-send / HEAD a325926、今回未commit。
最終追加の予約RPCによる重複再確認は自動承認レビューで拒否され未実行。安全な読取snapshotでsent/attempts1/許可falseを最終確認し、既存の成功した重複検査を採用。
次の1手: この差分と本番導入手順をレビューし、本番適用の明示承認を得る。自動ONは別判断。予約後の除外はBuffer側取消が必要（自動取消未実装）。証跡: docs/buffer-staging-final-result.json と各staging結果JSON。


## Buffer production rollout STOP（2026-10-22、最新）
最新添付3f3e6457でcommit/push/main/production migration/deploy/auto-send ONまで条件付き承認された。追加承認待ちではなく、重大安全条件未達のため本番反映前にSTOP。
確認した重大問題: 029 buffer_claimは予定の15〜2分前に取得し、workerはBufferへの予約作成直前だけ除外再検証する。受付後はsucceededとなり、snapshot.queue/claimの対象外。以後非公開/通報/掲載除外になっても外部予約の取消経路がなく、X公開を抑止できない。以前の手動取消という制約は今回の自動運用条件を満たさない。
追加不足: sender.inspect/buffer_reconcileはstaging-run手動操作だけで、通常automatic workerには未接続。公開結果不一致の自動検出・停止は未実装。cron登録も未実施。
再現: node docs/buffer-production-blocker-check.cjs。実workerと合成RPCで予約受付後の非公開化→次回automaticを実行。合成send1、cancel0、inspect0、状態succeeded維持。これは不具合の再現成功であり安全性PASSではない。結果docs/buffer-production-blockers.json。ネットワーク0、実DB変更0、外部投稿0。追加診断lint PASS。既存161件/typecheck/build PASSは前フェーズ実績で、今回の不足を検証していなかった。
Git: feature/buffer-queue-send、HEAD a325926。git fetch origin mainでremote最新a325926を確認。local mainはff1fe59のため、再開時は古いlocal mainを基準に上書きしない。今回commit/push/mergeなし、既存差分と並行監視差分を保持。
環境識別は既存記録のみ: production Supabase joedeuyrzimqyjapqpyh、staging fwqucffxdmbdczspkcyr、Vercel sonetokiyas-projects/minnade-tsukuru。今回live production API/DB/secretの確認・変更は未実施。029/030本番適用・deploy・production dry-run・queue smoke・cron smoke・本番送信は未実施。auto-send OFFのまま。Buffer専用24h監視は未開始、既存MVP監視設定は変更なし。
再開に必要な修正: 予約後の除外変更を外部公開まで安全に扱う送信方式/取消処理、通常予約の自動receipt照合、異常時にBufferだけ停止する制御と監視を実装し、stagingで取消/照合失敗/競合を検証。その後今回の有効な本番投入承認の範囲でrolloutを再開する。一般ユーザー作品で検証しない。
Status: in_progress（重大な公開安全性の不足で本番投入BLOCKED）。V2.1へ専念できる完了状態ではない。


## Buffer安全修正・staging再検収（2026-10-23 00:17 JST、最新）
Status: in_progress / production BLOCKED。最新添付68410385の条件付き本番投入承認は有効だが、staging DoDが全PASSではないため本番操作へ進まない。

実装: lifecycleによる予約後の適格性再評価、取消、通常公開結果照合、DBのBuffer専用kill switchを追加。予約受付をsentとせずscheduledで保存。通常投稿はBuffer下書き(saveToDraft)として保持し、予定時刻から2分以内に最新候補・停止状態・lease tokenを検証した1回のreleaseだけを許す。scheduler停止中に自律公開しない。release意図は先にDBへ保存、unknownを自動再送しない。公開照合は10分猶予、読取失敗3回で停止。除外/アカウント不一致/不整合/不明変更結果は即停止、停止後も取消/照合を継続。手動resumeはDB owner専用で未解決unknownを拒否。通常夜1/最大2/完成優先等は維持。

staging適用: 029/030はhash不変。031制御・取消/照合、032未送信取消のcap補正、033固定取消TEST本文、034公開guard、035scheduler構造、036transport ACL試行、037同期HTTPへの置換、038HTTPオプション互換、039応答検証。035/036のpg_net方式は採用しない。Supabase管理者所有のため036のREVOKEは実効なしと判明し、実秘密の登録前に037以降へ置換。最終tickはVaultの専用cron secretをメモリ内で使用し、HTTPコード/失敗回数のみ保存。pg_netキューへ秘密を保存しない。既存Vercel publish cronは変更なし。Hobbyは毎分cron不可のためSupabase pg_cronを候補とする。

検証: planner47 + connection25 + route11 + nativeDB122 = 205 PASS。typecheck・関連lint・外部通信遮断build PASS（既存middleware警告のみ）。合成再現テストは取消1/照合2となり旧ブロッカー再現false。staging追加状態遷移12群PASS。毎分DB tick 12回成功、HTTP疎通・HTML200拒否(502)・3回失敗停止・anon/authenticated/serviceからscheduler実行拒否を実検証。実credential付きデプロイ済みrouteとのcron end-to-endは未検証。全MVP試験/全体lintは再実行していない。

実取消: Buffer ID 6ada20dff09f431dcae37955、23:54予定を23:43に除外→取消成功。予定時刻後も未公開。既存X TEST 2113270930105409955はAPI読取照合成功。
公開方式の追加TEST: Buffer ID 6ada24ebbf6d801ac6f2bcaf を下書き保存、画面Drafts1/Queue0で確認。00:07:17にreleaseを1回実行したが成功応答として確定できずunknown/auto-send OFF。応答の詳細は当時保存しておらず原因未確定。再送0。読取ではdraftのまま、その後停止時cleanupで取消成功、DB cancelled/Buffer missing。追加X公開0、最終画面Queue0/Drafts0/Sent1。失敗を公開検収PASSと扱わない。次の検収用にHTTP status/typename/分類のみの秘密なし診断を追加した。

実データdry-run: candidates3/planned0/queued0/preSendEligible0、writes0/sends0（深夜の通常時間枠外）。最終stagingはactive0/unknown0/autoSend=false/testAuthorization=false/scheduler=false、一時cronはunschedule済み。既存MVP監視設定は変更なし。Buffer専用24h監視は本番未稼働なので未開始。

production DB/app/env/migration/deploy変更なし、main統合/pushなし。一般ユーザー作品の試験投稿なし、秘密露出なし（52対象ファイルで実環境秘密一致0）。branch feature/buffer-queue-send。既存監視の未commit差分は保全。
残作業: 追加公開TESTの上限を超えるため最大1件の再検証許可を質問中。許可前は追加予約しない。新しい診断でrelease結果を特定し、修正後のheld→公開→自動DB sentとhosted cron end-to-endをPASSにしてから本番再判定。許可待ちを自動再送の根拠にしない。V2.1に専念できる完了状態ではない。
証跡: buffer-safety-acceptance-result.json / buffer-held-publication-result.json / buffer-staging-cancellation-result.json / buffer-staging-migrations.json。
Updated at: 2026-10-23 00:17 JST


## 最終1件公開検収（2026-10-23 03:49 JST、最新）
Status: in_progress。添付3f05b307の最大1件だけを使用し、最終TESTはPASS。追加予約・再送・別TESTは実施しない。

手動TESTは040の限定guardでauto-send=false/MANUALのまま実施。Buffer ID 6ada5651ca69a1b7d3cfec46、予定03:39。公開直前に再評価、03:39:15にrelease意図を永続化し、editPostを1回だけ実行、HTTP200/PostActionSuccess。03:39:16.447公開、03:40:03.341に通常lifecycleでDB sent確定。external_id=2113339419771982087、external_url=https://x.com/minnade_tsukuru/status/2113339419771982087、sent_at/checked_at保存。X公開ページでも公式アカウントとTEST本文を確認。attempts1、同一候補再enqueue追加0、auto-send OFF。TEST許可は成功後falseに戻した。

releaseは検証済み本文を明示しdueAt=nullへ変更。以前の失敗応答が保存されていないため、以前の原因を断定しない。今回の新方式は実公開からDB sentまで成功した。新規TESTを要求する残課題はない。

cron: staging preview dpl_GnAKC652xwcXwhXi7XgWQxEy29aK Ready。https://minnade-tsukuru-staging-5pz40ulv9-sonetokiyas-projects.vercel.app の /api/cron/buffer で認証なし401、認証付き同時2実行200/dry-run/writes0/sends0。Vercel SSOは維持し公式automation credentialを使用。資格情報はWindows暗号化保管、Vercel preview専用Secret、表示/commitなし。041をstaging適用し、Vaultのautomation credentialはstaging宛にのみ付与。production宛ヘッダーは従来のcron認証だけ。

未完了: STAGING_DATABASE_URLが未登録（空または仮値）で、DB Vaultへの秘密登録とpg_cron→Vercel全経路が未検収。本人へ.env.staging.localのstaging接続URLを安全に登録するよう依頼済み。秘密をチャットに貼らせない。DB schedulerはOFFのまま。全経路PASS前にmain/push/production操作へ進まない。正式なDB接続を得たらVault登録・OFF/dry-runでscheduler検収、不要な一時cronを解除し、既存条件付き承認に沿って本番再判定。追加TESTは不要かつ禁止。

検証: planner47 + connection25 + route11 + nativeDB140 = 223 PASS（scheduler認証・OFF・HTML200拒否・3回失敗停止・権限拒否・競合skipを含む）。型チェック・関連lint・build PASS。追加運用scriptの未使用変数warningを除去済み。git diff --check PASS。最終staging dry-runはcandidates4/planned0/queued0/preSendEligible0/writes0/sends0。深夜の通常枠外。040/041適用済み、production migrationsなし。

branch feature/buffer-queue-send / HEAD 53e6c01、今回差分未commit。push/main merge/production deployなし。production DB/app/env変更なし。Buffer auto-send OFF、Buffer専用24h監視NOT STARTED、既存MVP監視差分/設定は保持。Buffer/X Production BLOCKED（cron全経路未完）。V2.1へ完全専念はまだ不可。
証跡: buffer-final-release-result.json / buffer-final-publication-result.json / buffer-final-test-progress.json / buffer-staging-hosted-cron-result.json / buffer-staging-dry-run-result.json。
Updated at: 2026-10-23 03:49 JST


## DB接続登録後の再確認（2026-10-23 03:59:32 JST）
Status: in_progress。本人の登録済み返信を受け接続前検査を実施したが、指定.env.staging.localのSTAGING_DATABASE_URLは空文字のまま。定義は1件、類似名の別ファイルなし、ファイル最終更新は2026-10-22 22:54:50 JST。秘密内容は出力していない。DB接続・Vault登録・scheduler全経路は未実施。エディターで対象ファイルを保存してから再開が必要。追加TEST・本番変更・push/merge/deployなし。最終TEST PASSと223テストPASSの状態を維持。


## cron全経路検収完了・本番導入開始（2026-10-23 04:07 JST）
Status: in_progress。登録済みstaging session pooler接続成功。Vaultの専用秘密をパラメーターで登録し、DB tick→Vercel dry-runは200。pg_cron定期実行もsucceeded/HTTP200、queueとattempts不変、送信0。一時cron解除、staging scheduler/auto-send OFFへ戻した。223テストPASS、hosted認証なし401/認証付き同時200。最終TEST成功のため追加TESTなし。
本番read-only事前検査: /・/login・/rooms・/works・Auth200、退会pause=false、不明副作用0、RLS不足0、Buffer既存表なし。既存MVP関数hash保存。Supabase statusはMonitoring継続だが現在の接続と主要経路に異常なし。
新規本番データ搬出は自動承認レビューで保存先の明示承認不足として拒否。搬出せず、既存バックアップ/復旧検証記録の整合性を確認。導入はBuffer専用追加のみ、各migrationのトランザクションと既存MVP関数hash/RLSを検査。036はstagingで無効だったpg_net ACL試行のため本番不要、040/041は手動TEST/staging認証用のため本番不要。本番対象029-035,037-039を個別適用予定。


## Buffer/X本番投入完了（2026-10-23 04:15 JST、最新）
Status: done。追加TESTなしでcron検収から再開し、本番投入COMPLETE。最終TESTは既存の2113339419771982087だけ、再予約/再送なし。

staging: 保存されたsession pooler URLでTLS接続成功。専用cron/automation秘密をVaultへパラメーター登録。DB tick→Vercel dry-run200、pg_cron定期実行succeeded/HTTP200、queue/attempts不変、送信0。一時job解除、staging auto-send/scheduler OFF。最終TEST許可OFF。

本番: 029,030,031,032,033,034,035,037,038,039を1件ずつhash照合・トランザクション適用し、全段階でRLS PASS・既存MVP関数hash不変。036は無効なACL試行、040/041は手動TEST/staging限定のため本番不要。新規バックアップ搬出は自動承認レビューで拒否され実施せず、既存バックアップ/復旧検証の整合性を確認して進めた。本番既存データの書換・MVP関数変更なし。

Git: bd17bf9（最終TEST/cron検収）、2ac2cf9（本番運用コード）をfeatureへpush、origin/mainへ通常fast-forward。forceなし。Vercel production dpl_5gabHTQsoTiomHnwpcUiNDmBHFFD / commit2ac2cf9 Ready。既存MVPフラグ・CRON_SECRET・Buffer API keyは変更せず、Buffer専用cron認証/運用モードだけ追加。既存publish cron維持。

本番検収: Buffer official channel接続200/BUFFER_CONNECTED、無認証401、dry-run200/candidates0/planned0/queued0/preSendEligible0/writes0/sends0。DB OFFで同時automatic呼出2件ともstopped/送信0。DB scheduler smoke200。/login,/rooms,/works200、既存MVP関数hash不変。223件tests・typecheck・関連lint・build PASS。最新運用script lint PASS。秘密実値のcommitなし。

04:13:42 JSTにBuffer専用auto-sendと毎分pg_cron minntuku-buffer-automaticをON。04:14の初回定期実行succeeded/HTTP200、連続失敗0、queue0、duplicate0、control enabled=true。現在レビュー/PII確認済み候補0のため一般作品の投稿0。公開許可レビュー必須の既存ルールを緩めていない。

監視: automation buffer-x-24 ACTIVE、15分ごと96回、2026-10-24 04:14 JSTまで。毎分workerのauto-stopに加え、重大異常ならBufferだけOFF、正常時は静かに記録。既存MVP heartbeat24は変更なし。24時間経過の完了を現時点で主張しない。Supabase status Monitoringは継続中だが今回staging/本番検収は成功。provider障害を監視継続。

Production app impact: Buffer専用DBオブジェクト・Vault/環境変数・API route・毎分cron追加。本体の既存関数/フラグ/ユーザーデータを保持。rollbackはBuffer controlをOFFにして新規送信停止、schedulerは取消/照合のため維持。旧デプロイへ戻す前に未処理予約の取消/照合を確認する。自動resume禁止。

証跡: buffer-production-migrations.json / buffer-production-smoke-result.json / buffer-production-app-health.json / buffer-production-enabled.json / buffer-production-monitor-latest.json / buffer-staging-scheduler-*-result.json。
Next: 本番Buffer専用監視を継続し、V2.1の実装へ専念可能。本人の追加操作不要。追加TESTは禁止のまま。
Updated at: 2026-10-23 04:15 JST
