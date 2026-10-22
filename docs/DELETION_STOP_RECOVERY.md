# 公開後の緊急操作（第52節最終）

現在は本番GO、全14flag有効・退会pause=false。運営者はリポジトリで次を実行する。現在のWindows profileに暗号化DB password/鍵が必要。

```powershell
Set-Location C:\dev\minnade\minnade-tsukuru
node scripts/release/production.cjs emergency-stop joedeuyrzimqyjapqpyh
```

まず退会pause=true。未確定のStorage/Auth副作用があれば全体guard追加を中止し、退会を止めたまま下のcheckpoint/reconcile手順を確認する。副作用がなければ既存public/Auth/Storage表を一時guardで停止する。通常利用者のログインも止まる。既発行signed URLと読み取りは失効しない。今回と同じguard SQLはstaging33表で停止/解除実証済み。公開後コマンド分岐はlint/構成確認のみで本番に再停止はしていない。

原因修正・互換app Ready・データとAuth/Storage照合後：

```powershell
node scripts/release/production.cjs emergency-resume joedeuyrzimqyjapqpyh
```

一時guardだけ解除し、退会pause=trueは維持する。TEST smoke後、DB所有者が `SELECT public.mvp_set_deletion_pause(false);` を実行して退会を最後に再開する。旧権限や旧APIを復活させない。限定停止はFEATURE_FLAG_MATRIXの該当flagを無効化して再配信する。env変更だけでは旧deploymentへ反映されない。

復元済みbackupはGit外の %LOCALAPPDATA%/minnade-release-private/release52。復元は本番へblind実行せず隔離コピーで照合し、既公開/既退会の削除・非表示を再適用する。Free/PITRなし、DPAPIはWindows profile依存。

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

# 退会 Stop / Recovery（第49節、2026-10-22）

027と互換appが前提。今回の操作対象は隔離stagingのみ。本番で下記SQL/HTTPを実行するには対象・時刻・実行者を含む別承認が必要。

## 停止の意味と順序

1. 新規受付の入口を止め、`MVP_ACCOUNT_REQUESTS_ENABLED=false` を配信候補に設定する。env変更だけでは既存deploymentに反映されないため、**DB pauseを待たせない**。
2. DB所有者の管理接続で `SELECT public.mvp_set_deletion_pause(true);` を実行しcommitする。027の初期値もtrue。service_role/anon/authenticatedから変更できない。
3. `SELECT public.mvp_deletion_operations();` を確認する。paused=true、新規claim/prepare/stage遷移/Storage・Authの新規permitが拒否される。Auth DELETE transactionも同じcontrol行の共有lockでpauseと直列化される。
4. `active_effects` とjobのstage・lease・checkpointを確認し、処理中workerの終了/paused応答を確認する。**paused=trueだけを停止完了としない**。SDKに送信済みの削除は取り消せない。Storage permit取得直後〜SDK送信の間もin-flightとして扱う。新permitは発行されず、既存permitの結果を照合する。
5. 受付/cron両入口を止め、`MVP_ACCOUNT_FINALIZE_ENABLED=false` の互換appへ反映する。受領済みjob・匿名化済み作品・lease・証跡を保持する。stage手動更新やAuth/Storage手動削除で先へ進めない。

管理snapshotのjobsは未完了100件まで。全件0を推定しない。効果履歴のunknown件数は過去の失敗も含むので、未完了jobに絞って照合する。具体的なeffect確認は所有者だけが次を実行する（ユーザー本文/メール/秘密は取得しない）。

```sql
SELECT e.id AS effect_id,e.job_id,e.effect,e.state,e.started_at,e.finished_at,
       j.stage,j.lease_until
FROM mvp_private.deletion_effects e
JOIN public.account_deletion_jobs j ON j.id=e.job_id
WHERE e.state IN ('started','unknown') AND j.stage<>'completed'
ORDER BY e.started_at LIMIT 100;
```

長時間処理は5分で調査開始する運用目安。5分でキャンセルされたとはしない。外部結果が不明なら停止を継続し、同jobの正確なAuth ID/ledger pathだけを承認された管理環境で確認する。Storage一覧/prefix一括削除をしない。

## 途中失敗と再開

- prepareはDB transaction。失敗はそのtransactionをrollback。成功後pauseなら匿名主体/履歴は保持したままrequestedで停止する。利用者の書込停止は解除しない。
- Storageの失敗/timeoutはunknown履歴を残す。次回同一pathの限定削除とDBの実体不存在確認を再実行する。used添付は削除候補に入れない。
- Authの失敗/timeoutはuser_not_foundの明示404だけを不存在証拠とする。接続失敗を削除成功へ変換しない。auth_unknownから同じjobで再開する。
- SDK終了後の効果記録失敗/プロセス死亡はstartedが残る。leaseが切れても新worker claimを拒否し、二重外部操作を防ぐ。
- startedの復旧: 全該当worker停止、lease終了、実SDK結果を照合し、私的incident台帳に確認者/時刻/対象ID/結果を記録してから、pause中の所有者が `SELECT public.mvp_reconcile_deletion_effect('<effect UUID>','worker_stopped_external_checked');` を実行する。本人が事実を確認したとの管理者申告を受けるAPIであり、自動的に外部停止を証明するものではない。固定証拠文字列だけを機械的に送らない。DBにsession_user/時刻/元effectを残しunknownへ移す。active lease中は拒否。
- 原因修正後、同じjob IDを使う。まずstagingで再現/再開検証。互換workerを用意し、所有者がpause=false、worker入口のみ有効化し、secret保護 `POST /api/cron/account-deletion` に `{ "requestId": "<job UUID>" }` を送る。secret値はログ/チャットへ出さない。
- APIの202/paused/retryは完了ではない。200/completed、Auth明示不存在、used保持、unused消去、他人作品不変を確認。成功後に新規受付を最後に戻す。needs_reviewは個別審査。

## rollbackと限界

027をdownして旧workerへ戻さない。pause=trueを維持した互換appで前進修正する。適用時には古いworkerを先にdrainする。DB外のAuth/Storage実体消去と匿名化は自動undoできない。backupにStorage実体が含まれると推定しない。

DB pauseは退会専用。全app/直接REST/Auth登録/通常upload/通常cleanup/cronの一括保守機構ではない。RLS問題では対象appだけでなく直接API境界も別途停止し、広い旧GRANTへ戻さず限定した修正を審査する。

## 他機能の停止

- Upload: MVP_UPLOADS_ENABLED=falseを互換deploymentに反映。投稿や既存添付の閲覧を一括停止しない。配信反映前の緊急停止には対象API入口の制御が別途必要。DB_GUARDSは常時trueを推奨。
- forced publish: schedulerを止め、MVP_DRAFTS_ENABLED=falseでcron/review/draft/公開作品署名を停止。旧rooms直接UPDATEへ戻らない。既に実行中のpublish transactionはenvで取消不可。DB結果を照合して再開。
- RLS: 対象app/直接REST/Storage経路の漏洩を止める管理手段を承認後に限定適用。無条件SELECT/旧view/広域権限の復活をrollbackとして使わない。
- Moderation: 単独操作はMVP_MODERATION_ENABLED、queueの対応はMVP_REPORT_QUEUE_ENABLED。両方を止める必要があるときは両方OFF。通報受付を保全し、メール窓口へ案内する。

## 検収証拠

`deletion-pause-local-result.json` と `deletion-pause-staging-result.json` が実行結果。A新規拒否/B prepare後/C Storage直前/D Auth直前/E再開/F二重workerを区別する。全基盤の復元訓練・本番運営担当の実演は別の未完了運用ゲート。
