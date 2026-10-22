# 第52節・最新チェックポイント（2026-10-22）

**Production APPLY GO / 公開GOは本番smoke待ち。** 暗号化DB/Auth/Storage backup、隔離復元68比較、実backupへの001〜028試適用28件＋Auth/Storage件数保持2件PASS。本番read-only preflight PASS。停止/再開16+8+7、退会停止復旧29 PASS。既存871・Android/reset PASSを再利用する。iPhoneは受容済みの公開後確認。実本番反映結果は後続記録を優先。

# 第52節の最新チェックポイント（2026-10-22）

本番READ ONLY暗号化backupは取得済み（DB49表、Storage16個）。DBパスワードは既存候補で接続成功し、変更不要。隔離restoreは実行中でまだPASSではない。

停止/再開は実stagingでアプリflag16項目、一時DBガード停止8項目/解除後7項目PASS。既存退会pause/recovery29件を再利用。終了時DBガード解除、retirement pause=true。証拠はrelease52-backup-result.json、release52-maintenance-result.json、release52-global-stop-result.json、release52-global-resume-result.jsonとAI_HANDOFF第52節。

最新ユーザー指示で本番backup/隔離restoreと全GO後のcommit/push/migration/deploy/smokeまで承認済み。下の旧記録にある「本番data dump禁止」「包括承認待ち」は現在の承認範囲ではない。秘密/本文/認証情報を出力しない制約は維持。実production適用/commit/push/deployはまだ未実行。全GO成立後は同じ実行内で続行する。

---
# Production preflight（第51節、2026-10-22）

**Production BLOCKED / NO-GO。** 条件付き実行承認は受領済み。最新は[18項目の最終検収](RELEASE_FINAL_ACCEPTANCE.md)。

- Android主要flowと同一Android Chromeでのreset/メール復帰はユーザー実施PASS。iPhoneは公開後必須の既知未検証リスクで、今回のblockerではない。
- production/staging双方custom Gmail SMTP587・30/h。stagingは新アプリパスワード設定後にreset到達/変更成功。production credentialの実送信は未検証。
- 本番Free backupなし、PITR未契約。schema/台帳だけでdata/Auth/Storage bytesを戻せない。暗号化保全・隔離復元・全入口保守/worker drainは未実証。
- 871関連検査、型/対象lint/最新Preview build/diff成功。既存全体lintエラーあり。001〜028不変/全台帳一致、150 Preview source一致、既存554ファイル消失なし。
- 最新Preview dpl_DsDczF9LzAakarptA5Yv7jUsVRHE Ready。staging新host callback2件だけユーザー承認後に保存。退会2flag=false、その他12=true、pause=true、cronなし。本番env/DB/配信変更なし。

未解消のbackup・保守・運営体制を具体的に検収してからGo判断する。現時点では本番data dumpを実行しておらず、production PII/本文は取得していない。

<details>
<summary>第50節以前の記録（現在の判定は上記を優先）</summary>

# Production preflight（第50節、2026-10-22）

**Production BLOCKED / NO-GO。条件付き本番実行承認あり、条件未成立につき未実行。** 最新は[最終検収](RELEASE_FINAL_ACCEPTANCE.md)と[証跡](release-preflight-result.json)。

- staging 001〜028適用済み。001〜027開始時hash不変、全28本台帳一致。028の年齢/現在同意とcallback/reset UIを追加検証。
- 検査868（offline703＋auth UI14＋監査schema PG137＋staging SDK14）、型/対象lint・local build・最終Vercel build成功。合成検査を実メール・実機の代替にしない。
- 独立staging Preview Ready、承認されたcallback2URL保存済み。DB pause=true、退会2flag=false、schedulerなし。本番Vercel/env変更なし。
- 本番最小カタログをBEGIN READ ONLY/ROLLBACK確認: public14表、mvp関数/台帳/退会構造/履歴表なし、他接続5。全schema一致の証明ではない。DashboardのFree/backupなしを実確認。ユーザー本文/PII取得なし。
- メール認証は実リンク→server記録で完了。Androidの同意/参加/文章/画像/Core/通報/作品/戻る等の主要操作はユーザー報告成功、対象stagingメタデータ照合済み。Androidメール復帰は未完了。resetは送信上限、iPhone実機なし。初期一括PASS回答は後の未ログインという訂正を優先して取り消した。
- 公開前残件: resetと実機、SMTP実運用、全入口保守/DB・Auth・Storage保全復元、本番適用前提、運営担当等。新規包括承認を求める前に未達を解消する。既存権限へ戻すrollback禁止。

<details>
<summary>第49節以前の記録（最新判断は上記を優先）</summary>

# Production preflight（第49節、2026-10-22）

**Technical GO / STAGING GO（今回の検証範囲）。Operational NO-GO。Production apply APPROVAL PENDING。** 本番未接続・未変更。完全無欠/100人同時負荷/全基盤復元を保証する判定ではない。

## 今回の変更と証拠

- 027: DB永続pause、prepare/stage/Storage/Auth/finalize前checkpoint、外部処理のstarted/finished/unknown、二重claim防止、Owner限定reconcile。隔離stagingに適用済み、終了時paused=true/active_effects=0。
- 既存001〜026は開始時hashと不変。適用台帳27本＋baseline=28。private新規3表はRLS有効、serviceのpause変更と旧prepare直接実行は拒否を実stagingで確認。
- 安全性関連flag14個を棚卸しし、OFF→旧書込のfallbackを削除。[matrix](FEATURE_FLAG_MATRIX.md)。ON時の旧公開作品互換は存続するため、既存PII審査は別ゲート。
- 代表窓口 minnadetsukuru.auth@gmail.com をTerms/Privacy/footer/通報/account helpへローカル反映。メール送信/公開なし。規約の意味変更は[文案](LEGAL_MVP_DRAFT.md)に留める。

今回の追加・再実行 **586項目**: route209、添付68、退会adapter26、退会/公開等75、限定運営23、queue29、監査schema PostgreSQL119、実staging停止復旧29、ローカルHTTP8。既存921へ単純加算しない。119には後続migrationで解消する中間状態の問題再現も含む。型/lint（警告0）/通信遮断build成功。buildに既存middleware非推奨・webpack cache警告あり。

実staging A新規拒否/B prepare後/C Storage直前/D Auth直前/E解除後完了/F二重workerの6ケースPASS。Storage used保持/unused cleanup、Auth保持→明示不存在を確認。SDK送信済み処理の取消しはできず、pauseとdrain確認を分ける。

## 正本

[停止/復旧](DELETION_STOP_RECOVERY.md) / [本番手順](PRODUCTION_ROLLOUT_PLAN.md) / [公開判定](PRODUCTION_GO_NO_GO.md) / [運営](OPERATIONS_READINESS.md) / [法務](LEGAL_REVIEW_CHECKLIST.md) / [保持](RETENTION_AND_PII_ACCEPTANCE.md)。旧節のflag/窓口未確定・pause未実証は更新済み。

## 残る公開前条件

primary、法務/保持/対象年齢・同意UI採用、既存PIIの確認担当・範囲、実メールとAndroid/iPhone、通常通報/監査の担当実演、全入口保守とDB/Auth/Storage保全復元、本番schema互換照合と適用承認。backupは強い推奨で、一人運営は時間限定・不在時停止等の条件付き候補。

本番へ適用する候補は001〜027＋互換app。staging baseline/verification/script/fixture/private envは本番実行対象外。退会はpauseを残した状態で適用し最後に有効化。


<details>
<summary>第48節以前の記録（最新判断は上記を優先）</summary>

# Production preflight / operational readiness

2026-10-22、第48節。**Technical Web MVP: 100%（合意したstaging検収範囲）/ STAGING GO。Production Launch: NO-GO、反映承認待ち。** 全攻撃不存在・100人同時負荷保証・本番安全証明という意味ではない。

今回の成果は既存実装と証跡の最終照合および手順書。新機能、SQL変更、staging再実行、本番接続/取得/変更、commit/push/deployなし。

## 正本と証拠

- [本番判定](PRODUCTION_GO_NO_GO.md): 未完了条件と承認5項目。
- [反映手順](PRODUCTION_ROLLOUT_PLAN.md): 依存順、停止、復旧、synthetic smoke。
- [001〜026マトリクス](MIGRATION_ACCEPTANCE_MATRIX.md): 26本の構造・権限・hash・停止条件。
- [運用準備](OPERATIONS_READINESS.md): 窓口、メール、実機、監視、運営UI不足。
- [法務判断票](LEGAL_REVIEW_CHECKLIST.md) / [保持とPII](RETENTION_AND_PII_ACCEPTANCE.md)。

FINAL_P1_ACCEPTANCE.md第47節の既知Technical P1=0を維持。退会8gate、Creator/Core/Member、使用済みStorage保持・未使用のみ削除・Auth SDK完了と再試行を確認した既存記録を採用する。

| 既存証跡 | 検査数 | 本日確認した範囲 |
|---|---:|---|
| deletion-p1-security-checks.txt | 708 | offline検査の既存成功記録 |
| staging-baseline-local-result.json | 103 | 監査schema、結果103件、local PG停止記録 |
| deletion-p1-concurrency.txt | 31 | 複数接続PostgreSQLの既存成功記録 |
| deletion-final-staging-result.json | 24 | complete=true、合成stagingのみ |
| web-full-staging-result.json | 48 | complete=true、failures空、serverStopped=true（うちresponsive 21） |
| moderation-web-result.json | 7 | complete=true、serverStopped=true |
| 合計 | 921 | 新規実行数ではない。完成率の分母ではない |

型・対象lint・build・diff成功は第47節の記録。今回はコード変更がないので再実行しない。全26 migrationの適用名/内容hashをローカル証跡と照合（改行の記録方式差はマトリクスC）。本番の適用済み状態は今回取得していない。

未実証: 本番適用/既存データ互換、実メール到達・実機、100人同時アプリ負荷、DB+Auth+Storage全体の復元、実運営担当・窓口・PII実態。staging baselineは閉鎖ACLで開始しStorage policyを複製していないため、本番設定を同一とみなさない。

## 本番反映対象と必須度

| カテゴリ | 対象 | 分類 |
|---|---|---|
| DB | 001〜026全件。番号順、各transaction | 本番前必須。superseded関数を含んでも省略しない |
| Permission | 005/021/022 restrictive RLS＋公開列、旧4view閉鎖、001/005/014/021 DML剥奪、017/019/020/023 internal/旧RPC閉鎖 | 本番前必須。一般roleとserviceの両方を検収 |
| API | 添付台帳/投稿atomic、認証・認可・rate、seen統合、join/Core、like/room作成、期限公開 | 本番前必須。新RPCとflagをセット |
| 旧経路 | join/Core/期限処理/debug/update等の410、旧UI2ファイル削除 | 本番前必須。旧呼出元へ戻さない |
| UI | consent/公開projection、投稿添付、Core、draft/作品、退会進捗、運営非表示/処理待ち通報 | 本番前必須。同じ候補appで検収 |
| 退会 | 023〜026＋Preparation/Adapter/worker、匿名名義/保持、2flag | 最後に有効化。適用だけで受付しない |
| 運用 | 実在連絡先・当番/代理・手動監査/再試行・停止境界・backup方針 | 一般公開前必須 |
| 清掃 | 013 helper/worker基盤は含む。通常unused定期実行は未接続 | 自動scheduleは本番後可。日次容量/滞留管理と承認制清掃は必要 |
| staging専用 | baseline、verification台帳、scripts/staging、synthetic fixtures、私的env/認証情報 | 本番実行禁止。既存本番へのbaseline適用禁止 |
| V2 | AI Creator、料金、検索/Creative Office/native/大規模管理画面 | 後回し。今回実装しない |

## Feature flagの実効動作

すべて文字列 `true` のときのみ有効。次の「公開候補値」は提案であり本番設定を読取/変更していない。

| 変数 | 公開候補 | false/未設定時の実際の動作 | 事故時の扱い |
|---|---|---|---|
| MVP_DB_GUARDS_ENABLED | true | upload/添付投稿503。rate無効、本文投稿は旧経路へ | uploadsだけのkill switchとしてOFFにしない。API入口を遮断 |
| MVP_ROOM_CREATION_ENABLED | true | room INSERT＋member upsertの旧2段階処理 | OFFで作成停止にはならない |
| MVP_ATOMIC_JOIN_ENABLED | true | 古いcheck→upsert経路 | OFFで参加停止にはならない |
| MVP_ATOMIC_CORE_ENABLED | true | Core申請/承認/却下503 | 停止可だが反映待ちあり |
| MVP_MEMBERSHIP_GUARDS_ENABLED | true | manage-member停止、markは旧経路 | 運営/mark全体の安全停止とは異なる |
| MVP_LIKE_REQUESTS_ENABLED | true | read→toggleの旧経路 | OFFは競合対策を外すため不可 |
| MVP_REPORT_INTAKE_ENABLED | true | reports直接INSERT。pending保護なし | OFFで受付停止にはならない。受付保護を維持 |
| MVP_REPORT_QUEUE_ENABLED | true | 運営一覧/対応503 | 受付は続く。代替監視と同時に扱う |
| MVP_MODERATION_ENABLED | true | 単独hide/restore API503 | queue経由hideは別flag/RPC。全部止めるには両入口遮断 |
| MVP_DRAFTS_ENABLED | true | draft/review API503、cronは旧rooms更新、作品/署名も旧判定へ | OFFで公開cron停止にはならない。scheduler＋入口を停止 |
| MVP_ACCOUNT_ATTRIBUTION_ENABLED | true | 退会名義補完表示を行わない | kill switchではない。匿名表示回帰を防ぐ |
| MVP_ACCOUNT_REQUESTS_ENABLED | 最後にtrue | 新規受付503、GET enabled=false | finalize workerは別入口。両flag/両経路確認 |
| MVP_ACCOUNT_FINALIZE_ENABLED | 最後にtrue | 受付は202保留、cron worker503 | 既に開始したworkerは止まらない |
| AI用 | 不要 | 推論/学習の実装未接続 | ai_levelは保存設定でkill switchではない |

根拠: lib/apiGuards.ts、app/api各route。envはhandler開始時に判断し、workerは各stageで再読取しない。Vercelの環境変数変更は既存deploymentへ反映されず、新deploymentが必要。[Vercel公式](https://vercel.com/docs/environment-variables)

**P2 / 公開STOP: 退会の即停止経路は未実証。** 将来の新規呼出し停止と、進行中の不可逆処理中断を区別する。退会API/worker入口遮断→新呼出し拒否確認→実行中job照合・drain→2flag OFFを反映した互換deployment、という順。現在のflagsだけで「即停止可能」と認定しない。安全な強制中断方法・最大待ち時間・担当者が未確定ならfinalizeを有効にしない。入口遮断も今回実施/設定していない。

## 環境分離とenvチェック（値は保存しない）

| 名前/設定 | ローカル確認 | 本番確認（承認後、値を記録しない） |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | .env.local / .env.staging.local とも非空 | production projectへ一致、Previewと分離 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 同上 | 対象projectのpublic key、Service Roleと異なる |
| SUPABASE_SERVICE_ROLE_KEY | 同上 | serverのみ。NEXT_PUBLIC名/props/bundleへ出さない |
| CRON_SECRET | .env.localに非空 | schedulerとserver一致、Authorizationをログに残さない |
| 全MVP_* | 上記2envファイルには未設定 | runnerの検収用注入と本番を混同しない。表どおり照合 |
| NEXT_PUBLIC_SUPPORT_EMAIL等 | 上記2envファイルには未設定 | 利用者向け実在窓口・受信確認（秘密ではないが今回は値不要） |
| Auth Site URL / Redirect allowlist | 本番未確認 | 正式originと /auth/callback。localhost/staging混入なし |
| Vercel Production / Preview / Development | 本番未確認 | URL/key/flagsのscopeとbuild時NEXT_PUBLIC埋込みを別々に照合 |
| payment/AI変数 | 不要 | 今回追加しない |

.env*、.staging-private、.next-stagingはgitignore、例外はplaceholderのみの.env.staging.example。scripts/staging/safety.cjsは専用env明示読み、production ref/同じkey/URL不一致を拒否。これは**テスト実行のguard**であり、通常appの起動・deployを自動防止するguardではない。通常npm dev/buildは本番envを読み得る。

リリースbuildの入力に.env.staging.local/私的raw/合成認証情報を渡さない。gitignoreだけではローカルCLI deployに同梱されない保証にならない。承認後は対象Git snapshotと管理されたproduction envからbuildし、公開bundleにstaging ref/keys/fixtureがないことを検査する。staging scriptsを本番schedulerやpostinstallへ登録しない。

## 今回のdiff review

開始: security/fix-storage-sign、tracked差分73ファイル（+1598/-2891）、untrackedにはdocs/migrations/lib/scripts。全非ignored 505パスを列挙し対象textを静的走査。envの値は出力せず存在のみ検査。

- app/lib/componentsにproduction/stagingのSupabase project ref hardcode、console.log/debug/error、TODO/FIXME、テスト認証bypassパターンなし。固定公開Web originはapp/layout.tsxのOGP用で、DB接続先ではない。
- credential形状検出はdocs/staging-safety-check.cjs内の合成接続URL fixtureのみ。短いtest用literalであり、実接続/実keyではない。通常sourceに実keyらしい一致なし。パターン走査は漏えい不存在の証明ではない。
- Service Role使用はserver API/SSR/workerに残る。本人getUser、canonical room/member/post、operator RPC、secret cronを使う経路を重点確認。ブラウザへ渡す修正なし。既存全route inventoryと第47節の認可検査を併用し、文字列検出だけで認可を合格にしない。
- debug/buckets、旧updateは無作用410。新規通報/運営/退会の通常書込停止・exact capabilityを確認。hidden対象の本文を運営UIから自由編集する入口はない。
- 021のUSING(true) permissive readerはrestrictive境界と同時適用する設計。trueだけを抽出して無防備と断定せず、table/column GRANTとANDされる全restrictiveも検収。既存広域ACLを復旧しない。
- P2残件: Core退出と承認のlock順/競合、profile複数表更新途中失敗等の既存課題はFINAL_FINISHING_ACCEPTANCE等の履歴を保持。今回の文書作業で修正済みにしない。
- 本番設定/既存行/未知FK/legacy Storageは未確認。本番の漏えい実証やPII 0件判定はしていない。

## commit候補（未実行）

推奨はレビュー用に4単位: ①DB/security+migrationsと共通guard、②account deletion、③moderationと残りWeb互換変更、④tests/docs/staging tooling。ただし共通helper/flag/ACLが密結合で中間commitはdeploy対象にしない。既存diffを勝手にsplit/stageしない。

承認後、hunkを依存順にレビューできなければ**1つの整合したrelease commit＋カテゴリ別説明**を優先する。断片ごとの本番deployより、検収済み同一treeを固定して1回releaseする。今回commit/stage/tag/branch操作は行わない。

## 本日完了 / 残る実施

完了: 証跡照合、26本レビュー/マトリクス、feature flag実効確認、文書統合、差分検査、手順準備。
未実施: 実メール/端末、窓口/法務採用、通常通報・監査の運営手順実演、停止/backup復元の実証、本番schema/config照合、全本番操作。

技術実装doneと今回preflight文書doneを維持しても、未完了チェックをPASSへ変更しない。

## 最終文書検証（本日）

新規/更新の正本7文書の相対リンク・文字化け・末尾空白を検査し問題なし。migration表A/B/Cに各001〜026を1回ずつ記載。開始時hashと比較しmigration全26本不変、docs以外無変更・削除なし。git diff --check成功（既存CRLF変換警告のみ）。AI_TASK/AI_HANDOFFを含め今回文書9件。コード変更なしのためtests/type/lint/buildは再実行していない。

</details>

</details>

</details>

