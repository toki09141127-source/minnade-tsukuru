# 運営準備（第51節、2026-10-22）

Android主要flowと同じChromeでのreset/メール復帰はPASS。iPhoneはKNOWN UNVERIFIED PLATFORM: iPhone Safari / POST-LAUNCH REQUIRED CHECKとして今回のblockerから除外。[最終検収](RELEASE_FINAL_ACCEPTANCE.md)に証拠源と限界を記録。

本番SMTPは既にcustom Gmail/587/30h。標準SMTP宛先制限はこの設定には直接当てはまらない。stagingもcustomへ変更し実reset到達成功。本番credential/到達は未試験。初期5〜10人、招待を小分け、目安20新規/時以内・残枠をreset/再送用とし、429/送信拒否/遅延で拡大停止。Gmailは個人向けの到達制約を持ち、transactional SMTPへの移行条件を記録する。送信成功を全宛先保証にしない。

未解消: primary/不在時運用、通常通報/監査の担当実演、全入口保守とDB/Auth/Storage保全・隔離復元。Free backup/PITRなしを確認。実行者・私的保管先・復旧時間を決める必要がある。窓口 minnadetsukuru.auth@gmail.com と18歳以上/文書導線は既存実装を維持。

SMTP新規credential入力・保存は本人操作。チャット掲載値は失効/再発行を案内、ユーザーから新しい値で保存済みと回答。secret/認証URLを記録しない。

<details>
<summary>第50節以前の記録（現在の判定は上記を優先）</summary>

# 運営準備（第50節、2026-10-22）

[最終リリース検収](RELEASE_FINAL_ACCEPTANCE.md)を最新とする。代表窓口 minnadetsukuru.auth@gmail.com、初期MVP18歳以上は確定。Terms/Privacy/Guidelines・footer/login/参加同意/profile/report help導線を実装し隔離Previewへ配信。

メール認証・Androidログインは進展したが、メール送信上限でreset未検収。SMTP/Hookの到達・再送・上限・エラー対応を100人公開前に検収する。iPhone実機は未確保。primary/不在時運用、通常通報/監査の担当実演、全入口保守とDB/Auth/Storage保全復元は引き続き未確認。staging通報queueは例外pendingのみで、通常通報すべての一覧ではない。

条件付き本番反映承認は受領済み。ユーザーの初期一括PASS選択は未ログインの訂正により取り消し、個々の実行結果で判定する。最終Go前に運用責任者と時間を記録する。

<details>
<summary>第49節以前の記録（最新判断は上記を優先）</summary>

# 運用準備（第49節、2026-10-22）

Operational GO: **USER ACTION REQUIRED / NO-GO**。実メール・実機・担当・法務採用・全入口保守/復元の人手確認は未完了。本番操作なし。

## 正式窓口と掲載

**minnadetsukuru.auth@gmail.com** は確定済みのMVP代表窓口で、意図された公開連絡先。新しいアドレスの作成/送信/本番設定変更はしていない。Terms、Privacy、共通footer、通報フォーム内、profileの退会Helpにローカルmailtoを追加。今後の文面はlib/supportContact.tsの1か所で管理する。

アプリ内通報: 投稿/作品/PII/著作権/誹謗中傷/不適切内容等の対象を指定して受領。メール: 詳しい著作権申立て、Privacy請求、account問題、フォームで足りない事情、法的・運営連絡、一般問い合わせ。対象URL/受付番号/希望だけを初回案内し、password/認証コードを送らせない。アプリ通報が503でもメールで連絡可能。

## 担当と対応目安

primary未確定は公開blocking。氏名を公開する必要はないが、受信/返信、日次queue+通常通報確認、限定監査、事故停止/再開ができる担当を私的台帳へ登録する。
backupは強い推奨。100人MVPはprimary1人で開始可能な運用案。ただし、対応可能時間を限定し、毎日確認、長時間不在時の受付/公開拡大停止、緊急時の保守/非表示手順、連絡の引継ぎ方法を決める。代理なしで24時間監視を約束しない。本人の不在時に停止もできない運用なら公開blocking。初日監視計画は現実に担当できる時間帯へ限定し、5→20→100人の段階拡大を採用候補とする。

内部の初回確認目安（保証SLAではない）:
- PII漏洩疑い: 可能な限り当日確認、確認次第優先して暫定非表示。
- 著作権/権利侵害: 1〜3営業日。
- 不適切コンテンツ: 1営業日程度。
- account問い合わせ: 2〜3営業日程度。

24時間365日対応や期限内の解決を約束しない。未解決は担当/次回確認日を設定し、遅延時に事情を返信する案。今回メールは送信しない。

## 実装された権限と監査

- 基盤Owner（運用上の名称）: Supabase/配信側の管理者。027 pause/管理snapshot/結果不明照合を操作。appにOwnerという新roleは追加していない。
- Moderator: 現行operator登録済みかつ退会中でない担当のみ。hide/restore、pending queue一覧、理由付き対応hidden/no_actionが可能。任意列更新/本文編集/役割昇格/Auth削除/pause切替は不可。
- hide/restoreはmoderation_actions、report処理はreport_resolutions＋必要なmoderation監査を同じtransactionで記録。監査失敗は処理をrollback。今回23限定運営/29queue回帰で確認。
- general account restriction/ban API・監査・UIは**未実装**。退会中の書込停止を一般banとして流用しない。新規全機能開発は今回しない。MVPでは非表示・rate・ルーム追放と受付/機能停止で暫定対処し、反復悪用を止められなければ公開拡大停止。account restrictionを提供済みと告知しない。P2運用リスクとして採用確認。
- queueはpending例外受付のみ。processed receiptは人による審査済みの意味ではない。全通報/監査の一覧UIはなく、Ownerの日次限定確認と私的台帳が必要。UIだけで運営完結としない。

日次はqueue全ページ/滞留、前回確認以降のprocessed/旧reports、moderation監査、未完了退会を必要なID/時刻に絞って確認する。秘密値・本文一括exportはしない。通常通報の対応は受付ID/判断/担当/時刻/監査IDを私的に記録。Operator登録/解除・本番data照会は別承認。

## PII緊急runbook

1. 現役operatorが対象post/roomを暫定非表示。不要な一般公開を優先停止。
2. アクセスを限定した私的incident台帳に対象ID/時刻/判断/監査IDを保全。本文の汎用ログ転記は禁止。
3. 関連作品/添付/旧署名/ダウンロード済みコピーの影響範囲を確認。新署名拒否だけで既発行URLを失効したとはしない。
4. primaryが事実を整理し、上記メール窓口から本人等へ必要な連絡を行う案。法的報告/通知要否・期限は専門家と確認。今回は送信しない。
5. 必要なPII削除/訂正/匿名化は権利/保持/共同制作への影響を確認した限定手順を別承認。現UIのis_hiddenだけで本文訂正済みとしない。
6. incident経緯/原因/影響/再発防止/復旧条件/終了判断/見直し日を記録。確認前に被害なしと発表しない。

既存公開作品のPIIは未調査。本番取得は今回なし。担当と範囲を決め、公開前の別承認確認が必要。

## 残る人手検収

一般アドレスへのsignup/確認/reset/返信の実メール、Android Chrome/iPhone Safari、通常通報/監査の担当実演、全入口保守/保全復元の範囲を確認する。旧節の実メール/実機チェック項目を使う。DB退会pauseの実証と全サービス復元を混同しない。[退会停止手順](DELETION_STOP_RECOVERY.md) / [flag](FEATURE_FLAG_MATRIX.md) / [法務文案](LEGAL_MVP_DRAFT.md)。


<details>
<summary>第48節以前の記録（最新判断は上記を優先）</summary>

# 運用準備・実メール・実機（第48節、2026-10-22）

手順準備済み。実施・担当・採用は未確認。本番アクセス、メール送信、端末操作、通知、設定変更は今回なし。Technical STAGING GOを実運用PASSへ読み替えない。

## 1. 実在窓口1本と担当

privacy / copyright / inappropriate content / account supportは同一の実在メールで分類可能。MVPにhelpdeskは不要。主担当1名＋代理1名、対応時間、受信・返信・迷惑メール確認を決める。未登録者、退会後の利用者、権利者も連絡できること。架空アドレスを設定しない。

文案: 「個人情報・著作権・不適切な投稿・アカウントに関するお問い合わせは［確定窓口］へ。対象ページのURLまたは受付番号と、ご希望の対応をお知らせください。パスワードや認証コードは送らないでください。」

内部目標候補: 緊急公開危険は確認次第優先非表示、通常初回応答2営業日、未解決は週次見直し。24h/72hの旧案、法定期限、保証SLAと混同しない。pending 24h超は滞留の目安として別扱い。

| 配置 | 現状 | 公開前の対応 |
|---|---|---|
| 利用規約 | TermsContentにenvのmailto、未設定時は設定案内 | 実窓口と文言の確認 |
| Privacy | 同じcontact env、未設定案内 | 請求/本人確認/保持説明へ接続 |
| 通報画面 | ログイン利用者の対象通報のみ | 未登録権利者のメール導線が残る |
| footer | layoutにfooterなし、Headerに規約リンク | 共通連絡先/Privacy導線の小修正が残る |
| account support | 退会受付番号あり、メール導線なし | 受付番号で相談できるリンク/文言が残る |

NEXT_PUBLIC_SUPPORT_EMAIL（優先）/SUPPORT_EMAIL/CONTACT_EMAILで現行規約の窓口を表示する。ローカルenvには未設定、本番設定は未確認。窓口決定後の文言・導線反映は未完了。今回新しいUIを作ったとは扱わない。

## 2. 運営UIと不足

| 業務 | できること | 限界・MVP運用 |
|---|---|---|
| 処理待ち通報 | /moderation ReportQueue、件数/最古/24h超/50件cursor | report_intake.pendingかつ未対応のみ |
| 対応済み | 理由必須hidden/no_action、一意対応、監査atomic | processedは人の審査完了ではない |
| 非表示/解除 | target ID指定、is_hiddenだけ変更 | deleted復元/本文編集/Auth削除は不可 |
| 全通報 | 専用一覧なし | processed receipt/旧reportsの限定日次確認が必要 |
| 監査 | 保存あり、履歴一覧UIなし | moderation_actions/report_resolutions限定読取 |
| 退会復旧 | 受付番号、retry/needs_review表示 | secret workerは管理者経路、UIから不可 |
| flag停止 | UIなし | 基盤管理者が入口停止・配信。OFFで止まらないflagあり |

**P2・公開前要実証**: UIだけで全通報・監査・退会復旧・事故停止を完結できない。大規模画面を追加せず、権限を持つ担当の限定読取と私的受付台帳で補う。担当が実行できなければ公開しない。

日次2回（開始/終了）の手順候補:

1. 現役operatorがqueueを更新し全ページと滞留を確認。queue 0件を全通報0件と扱わない。
2. DB管理権限を持つ担当が前回確認時刻以降のprocessed receipt/旧reportsを日時＋ID順に100件以下ずつ限定確認。対象ID/種別/理由だけ、通報者IDや作品全文を汎用ログへコピーしない。閲覧SQLは別レビュー、今回は作成・実行なし。
3. pendingはUIで対応理由を記録。通常通報は私的台帳に受付ID・判断・担当・時刻・moderation操作IDを記録。processedをpendingへ偽装しない。非表示は既存UIを使う。
4. 当日moderation_actions/report_resolutionsを限定照合し、監査なしは成功扱いにしない。直接serviceアクセスが閉じた表へGRANTを追加しない。
5. 未完了退会を受付番号/stage/更新時刻/leaseだけで照合。lease未満了・別worker稼働中は再実行せず、needs_reviewは原因を確認する。
6. retryは同job IDでsecret保護POST /api/cron/account-deletionから再開。自動schedulerなし。stageの手動更新、Auth/Storage手動削除、Auth削除後の本人再login要求をしない。

operator登録/解除は別承認。退会中operatorは代理へ交代し、通常の書込停止を解除しない。secretをブラウザ・チャット・利用者へ渡さない。

## 3. 実メール USER ACTION REQUIRED

先にstaging＋専用受信箱。本番は別承認後のTESTのみ。個人の本番メインメールを削除テストに使わない。確認URL全体/reset token/メール本文を証跡へ貼らない。

送信基盤を先に確認する。Supabase標準SMTPは非本番向けでteam外アドレスへの送信を制限し、現行公式説明では2通/時。一般利用者100人へそのまま使えるとは判断しない。本番SMTPは未確認。既存送信基盤/無料範囲のcustom SMTP可否、送信元、上限、redirectを運営が確認し、必要な設定変更は別承認。今回有料導入・Auth設定変更なし。[公式SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

- [ ] 専用testアドレスでsignup。確認前の扱いが設定・文言と一致。
- [ ] 受信/迷惑メール・正しい差出人/domain・到達時間。team内だけの成功を一般利用者到達とみなさない。
- [ ] 確認リンク→対象originの/auth/callback→認証・同意・profile。別accountへ誤接続しない。
- [ ] login→logout→再読込。認証必須の更新が拒否される。
- [ ] password reset: loginの再設定メール→callback後、プロフィールのパスワード欄で変更・保存→logout→新password成功、旧password拒否。専用reset画面はなくcallbackはトップへ戻る。profile保存の途中エラーも未完として記録する。
- [ ] TEST退会完了後、旧login/refresh/既存session書込が拒否される。

記録は環境・時刻・段階・安全なerror code・PASS/FAILだけ。失敗をAuth自動確認や同意省略で回避しない。

## 4. 実機 USER ACTION REQUIRED

Android Chrome / iPhone Safariを各1台。OS/browser version、staging origin、日付、担当を記録。320/375/390の既存layout検査は繰り返さず、以下1周でOS固有の入力・picker・session・復帰を確認。

1. メールアプリ→確認リンク→対象browserでlogin。別タブ/アプリ復帰で意図したaccount、logout後戻るで更新不可。
2. room list→detailを実指操作。アドレスバー伸縮・スクロール・戻るで操作を失わない。
3. join/consent: keyboard・文字拡大・回転でもcheckbox/確認/取消が押せる。二重tapで重複参加なし。
4. 日本語IME投稿: 変換確定時の誤送信、keyboardが送信ボタンを隠さない。
5. 小PNG/JPEGの写真/ファイルpicker、取消→再選択、4MB超/未対応HEIC等の分かるエラー、background復帰後の重複uploadなし。顔/位置情報のある実写真を使わない。
6. Core申請をtouchで確認、他actor承認後の復帰でrole表示更新。
7. works/添付表示、署名期限切れ後の再取得。空白画面で止まらない。
8. report理由IME→送信→結果、通信中復帰/再送。最後にlogout。

FAIL箇所のみ再現・修正・再試験。native/PWA/全OS保証は範囲外。

## 5. PII・保持の運用

正本: [保持候補とPII](RETENTION_AND_PII_ACCEPTANCE.md)。本番内容は未取得、PII 0件とは判定しない。

対象: profile名/bio/SNS、room名/説明、投稿/制作log/表示名、画像位置情報/PDF/動画/旧filename。006はdraftのない既存公開作品を互換公開するため、新規審査だけでは旧PIIは隠れない。

別承認の限定管理環境で対象期間/公開範囲を絞る→email/電話/住所等の検出候補ID→operator目視→緊急post/room非表示→権利/本人確認→判断/異議/期限を私的台帳へ。内容を外部AIへ送らない。新署名拒否でも既発行URLの期限/保存済みコピーは残り得る。

匿名化/訂正は別の権限・共同権利判断が必要。現UIはis_hiddenのみ。全本文の自動置換は禁止。利用者請求は最小本人/代理確認、対象/希望受付、必要な保全/暫定hide、結果通知、期限付き証跡。本人確認書類を初回から一律要求しない。

## 6. 最初の24時間の監視

Vercel/Supabase既存ログのみ。プランでの閲覧可否/保持期間は担当が事前確認。新有料監視なし。token/Authorization/email本文/署名URL/作品本文をコピーしない。

候補: 最初60分は15分ごと、以後24時間までは2時間ごと、その後日次2回。夜間代理を含め実行できなければ拡大延期。時刻・route/category・status/count・匿名化request/job ID・対応のみ記録。

| 観測 | 既存取得先 | 初動基準候補（SLAではない） |
|---|---|---|
| 500/503・DB制約 | Vercel function / Supabase DBログ | 同一必須経路5分3件又はsmoke1件失敗で拡大停止 |
| Auth失敗 | Authログ＋TEST login | TEST再現1件で停止。入力間違い単発と区別 |
| Storage失敗 | API status＋Storageログ | used消去/foreign取得1件は即STOP、5分3件失敗でupload遮断 |
| forced publish | cron結果＋TEST snapshot | 重複/未審査新log公開1件でschedulerと入口停止 |
| 通報 | queue＋通常通報の別確認 | 24h超1件で当番対応、受付/監査欠落1件で即調査 |
| 退会 | job stage/更新時刻/lease | needs_review 1件、retry30分継続を調査。誤完了/予定外削除は即停止 |
| rate/不審要求 | 429・401/403傾向 | 5分10件集中を調査、正規user巻添えでも拡大停止 |
| 容量/使用量 | 既存dashboard | 無料枠80%で拡大停止、課金を自動承認しない |

## 7. Incident

| 事象 | 初動 | 復旧条件 |
|---|---|---|
| Auth不能 | signup/更新入口を停止、時刻/件数保全 | schema互換app＋TEST正常、旧脆弱版へ戻さない |
| Storage異常 | upload入口、必要なら新署名入口遮断 | 所有権/使用済み保持。DB_GUARDS OFFは不可 |
| RLS漏洩疑い | appと直接REST/Storageの該当読取を止める | 狭い拒否修正＋TEST deny。旧広域policyへ戻さない |
| 退会異常 | 受付/worker入口遮断→実行中job照合/drain→2flag OFF反映 | receipt/Auth/Storage照合後、同job前進。物理削除の自動復元なし |
| 公開重複 | scheduler＋cron endpoint停止 | 冪等性確認。DRAFTS OFFは旧処理へ戻るので不可 |
| 通報/運営異常 | 受領保全、個別hide/resolve保留、必要なら入口限定遮断 | intake OFFで保護を外さない。監査/結果を照合 |
| key漏えい疑い | 関係入口停止、秘密を貼らず責任者連絡 | 失効/再発行は別承認。今回secret変更なし |

通知判断は責任者に集約し、事実/影響を確認して法務・専門家と判断。被害不明を「被害なし」と発表しない。flagだけで即停止できない点と停止境界未実証は[preflight](PRODUCTION_PREFLIGHT.md)参照。

## 8. 実施記録（現在未完了）

- 窓口/担当/代理/対応時間: 未確定
- 一般アドレスへのメール到達/reset/退会後拒否: 未実施
- Android Chrome/iPhone Safari: 未実施
- 通常通報/監査/退会復旧の限定運営手順実演: 未実施
- 停止境界/worker drain/復元訓練/ログ閲覧可否: 未実施
- PII/保持候補採用・対象審査担当: 未確定

文書準備だけでPASSへ変更しない。本番操作は[rollout](PRODUCTION_ROLLOUT_PLAN.md)の別承認後のみ。

</details>

</details>

</details>
