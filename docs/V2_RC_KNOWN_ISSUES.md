# V2 RC known issues / boundaries

## 最新: 2026-10-24 V2 PRODUCTION COMPLETE / V2 FREE LAUNCH

本人f42d38a4の明示承認により、最終実機signup/reset未完了をKnown Riskとして受容し、本番反映を完了。AI・Live Billing・synthetic productionはOFF。一般書込OPEN、Owner1、退会ON、Buffer送信の意図的OFF・元scheduler/cronを維持。042-059の18migration、既存hash/backup/restore、本番共同制作smoke・Security・26追加表RLS・退会保持/削除・Admin・Buffer状態確認PASS。

Owner初期化の既存資格台帳との接続漏れは、本人の2件限定承認後に監査付き補完し非表示/復帰PASS。TEST Owner無効化/資格除去/session0、実Ownerのみ保持。RLS・GRANT・関数定義の変更なし。

main/release/v2-rc1: ca1b589へff-only統合・push、正式tag v2.0.0。Git自動本番deployment READY/canonical一致、主要11経路200、Pricing準備中。初回monitor alerts0、heartbeat v2-24が10/25 22:45 JSTまでACTIVE。詳細・復旧条件・証跡はV2_FREE_LAUNCH_RESULT.md。

未解決Known Risk: 最新本番Android/iPhoneの登録・再設定メール復帰は未再検収でPASSではない。メール2本文は本番保存/readback済み。Real OpenAI verification pending（過去の限定応答試験を否定する意味ではなく、本番機能ONの検収は未完）；Live Billing not enabled。Managed Auth/SMTPログ自動収集、別端末でのbackup復旧、常時有人監視は未提供。AI/有料法務・価格・Stripe live運用は有効化時の別ゲート。

以下は移行前の履歴。古いNO-GO/本番未変更の記述を現在の状態として使用しない。

## 現在の判定
FREE V2 CONDITIONAL GO（AI OFF / Live Billing OFF）。iPhone再設定全手順・本人logout PASS、検収共有/Cookie/転送/session終了。初回signup callbackは未再検収として残し、本番のsignup/recovery smokeを切替条件とする。V2_PRODUCTION_FINAL_ACCEPTANCE.md参照。

## RCで許容する未検収
- 過去のV2.2 HTTP429は、本人の課金設定確認後に限定8回の実API検収へ進展。参照不整合は修正・限定応答PASS。手動Draft実E2E・最大費用・価格/credit判断は未完、AI ON不可。
- Android/iPhoneの今回の必須実機はPASS。iPhone初回signup callback FAILは履歴保持し、修正版の成功は再設定経路。スクリーンリーダー検収や本番Auth smokeを実施したとはしない。
- Native PostgreSQLのfresh再構築ではpg_cron/pg_net/http/Vaultを通信不能の明示contract fixtureで用意。58本のapp SQL、constraints/RLS/ACL/RPC/trigger/cron関連表を検査。managed extension本体のインストールは未検査。実stagingでextension存在・最終同期HTTP関数・実ACL・停止状態を別に照合済み。
- 監査済みproduction baseline artifactは非公開ローカル資料。リポジトリだけでSupabase管理schemaを再現できるとはしない。

## 安全上の既知制約
- 発行済み短期Storage URLや既に取得されたコンテンツの即時回収はできない。
- AdminのJWT発行時刻制限はMFA/直近password入力の証明ではない。
- AI/自由記述のPII検査はheuristic。人間による公開前確認を維持する。
- Supabase管理Auth/SMTPログ、実運用の無人cron、別端末backup復旧は今回のRC検収外。
- Stripe test用の一時転送は本番恒久Webhookではない。live billingはOFF。

## 今回の検収スクリプト修正
- RCコピー時のRPC名とStripe CLI設定の参照先を訂正。アプリ不具合ではない。途中で作った合成fixtureを再利用し、失敗をPASSとして計上しない。
- Hosted統合の4つ目のルーム作成は3回/時制限に正常に拒否された。制限は変更せず、未使用合成Creatorで残ケースを再開した。
- 旧local runner一括置換は自動承認レビューが既存ロジック保持のため拒否。旧runnerを残し、RC専用runnerを使用する。旧phase runnerと旧hash scannerはcanonical採番に未対応で、現在の統合検証入口はscripts/rc/fresh.cjsとscripts/rc/secret-scan.cjs。
- 旧staging migration installerはcanonical map存在時に実行前停止。旧番号の再適用を防止する。

最新判定と未完了項目はV2_RC_ACCEPTANCE.mdを優先。本番移行の未解消ゲートはV2_RC_PRODUCTION_ROLLOUT.mdに記載。

## 最終検収で解消した検収側の問題
- pg_dumpの実行バイナリと空のPGSERVICE指定を修正。restore ACLは順序に依存しない比較へ変更。データ件数/構造/実効ACL一致を確認。
- local Admin rate testはminute境界を跨ぐ31回を誤判定し得た。上限本体を変更せず2 bucket以内の拒否確認へ修正。
- 旧AI停止テストは新APIのkind/requestId不足で409。正しい入力で503・人間の制作継続を確認。
- 退会テストのVM間Array比較を修正。合成失敗2件のStorage/Auth実在とlease終了を照合し、既存DB owner復旧経路から対象jobだけ再開。job/effect書換えなし。Auth失敗後retryで完了し、添付は再取得・metadata照合で保持/削除を確認。
- 退会unknown effectがある場合、Owner UIは再開を拒否する。既存runbookどおり外部状態の照合とDB ownerの復旧判断が必要。今回の合成故障復旧を一般の自動再開許可としない。
- 初回admin UIのconsole1件はModeratorのOwner専用APIへの403。通常10画面とnegative caseを分けた再検査はunexpected console0。初回complete:falseの証跡も保持。

## 2026-10-24 本番移行前検収による更新（上記RC時点の状態より優先）
- AI eafb75e: 未Highlight参照によるINVALID_OUTPUTを生成schemaのref allowlistで修正。validatorを維持。unit59/型/lint/build PASS。実API累計8回、6種類の限定実応答を確認。Draftの通常依頼は残credit1で拒否、出力契約だけ追加確認。Hostedはsyntheticで、real provider結果と区別する。
- 6種類各1件の原価は測定済み。最大入力/長期平均/system AIを含む価格とcreditの安全性はINSUFFICIENT DATA。AI停止復元済み。
- 実production暗号化backup/隔離restore/042〜058の17件rehearsalはDB範囲PASS、105 checks、38適用hash一致。managed service/別端末鍵復旧/途中HTTPは別条件。
- P1 release: staging限定V2/Admin gateと本番Free billing退会前処理の未接続。gateだけ開けると052 Auth guardが退会を拒否し得る。productionへ配信しない。
- P2: 両端末の依頼済み操作は訂正後Work/logを含めPASS。物理端末の決済確定/退会完遂/メール復帰、無料規約、Owner bootstrap、原価/credit判断、managed復旧。所有者候補のみ本人指定済み。
- Liveはtest専用adapter/DB・法務・Stripe設定が未準備。OFF維持。
- 旧実機リンクは確認終了後にOnly people with accessへ戻して共有停止。修正版Cookie削除/検収browser終了/session signout済み。tokenをdocs/Gitへ記録しない。端末内のCookieや利用者のstaging sessionを遠隔削除したとは主張しない。
- 初回修正版Previewのwork timeoutは検収対象のis_hidden=trueが原因。安全な非表示を維持して別の公開合成作品に訂正し、失敗証跡を保持。
- 最新本番判定はV2_PRODUCTION_FINAL_ACCEPTANCE.md（Free条件付きGO、Full NO-GO）。

## 3134adb2 更新（上記より優先）
- P1 production Free/Admin gateと退会接続: 本人の具体的承認後にローカル修正、52境界checksと関連suite/型/lint/build PASS。productionは未反映。UIをOFFにしてもV2退会確認は続き、provider不明なら停止する。
- 無料規約案: 本人採用済み。Terms/Privacy 2026-10-24と再同意migration059を準備しstaging適用。旧同意のbackfillなし。旧Previewは旧版を送るため新同意には使わない。最新Previewの文面・同意保持5 checks PASS。
- Ownerの監査付きbootstrapとFree退会のstaging transaction各6 checks PASS、全行ROLLBACK。Owner指定済み、本番role付与なし。
- 059追加のため既存backupを再利用し042〜059の18件、隔離復元106 checks PASS。新production取得なし、平文/server cleanup済み。managed復旧/別端末鍵/途中HTTPは範囲外を維持。
- 最新メール復帰はAndroid PASS / iPhone FAIL。iPhoneの確認メール自体はREAD ONLYのAuth metadataで確認済み、sign-in実績なし。callbackの汎用エラーのみで原因未確定、通常Safari loginを1回依頼中。PKCEは開始したbrowser/deviceの保存状態が必要だが、今回はbrowserの違いを未確認のため原因と断定しない（[Supabase公式](https://supabase.com/docs/guides/auth/sessions/pkce-flow)）。物理両端末の決済確定・少なくとも1台の退会完遂はNOT RUN。既存画面閲覧/自動staging PASSで代替しない。
- Full V2は有料法務/価格credit/Live実装/AI残検収でNO-GO。Free V2も今回の実機条件が揃うまでNO-GO。公開・他PreviewへのCookie利用許可を自動推定しない。

最新追記: iPhone通常Safari login成功を本人報告とREAD ONLY metadataで確認。メール自動復帰の原因は未確定で初回FAILは保持し、決済検収へ進む。test通知窓は最新jrvv8pum3・指定2顧客だけ、2026-10-24 06:40 JSTまで。AI/退会停止は維持。

次の実機更新: 両端末test決済完遂/Plus500/reloadはPASS、各1契約・現期間付与1行をStripe/DBで照合。配送6中2成功/4retryable、DB pending0で状態収束。正確な4件の原因・全配送の成功は未証明。

### 06:23 JST 最新状態（上記の依頼中・NOT RUNより優先）
Android退会完遂・再読込後編集不可・旧password login拒否は本人報告PASS。READ ONLYのDB/Auth確認とStripe test契約canceledでも裏付け。06:15 JSTに退会窓を終了し全元flagsを復元、他26job不変、active lease0、Cookie/locks削除・転送/合成Owner session終了。作品/投稿/添付0の対象で、内容保持は既存合成E2Eの別証拠。

残る実機blockerはiPhoneメール復帰。同じSafariで1回のresetメール検収を依頼中。初回signup callback FAILと通常login PASSは別記録として維持。最新Share/2callback、iPhone session/test契約はこの結果待ちで保持し、検収終了後cleanupする。FullはAI/Live/有料法務/価格creditが別blocker、FreeもメールAuth未解消でNO-GO。production変更NONE。

### 06:42 JST iPhone追加FAIL
本人が同じSafari別タブでresetメール2回とも確認不能と報告。正しいstaging project/Preview/callback指定とAuthコード発行を確認。メールの誤配送先・別タブそのものを原因とは断定しない。実SDK+合成Authの別タブ正常ケースはローカルでPASS。callbackで失敗段階と固定コードを表示する診断変更を追加（生error/URLを表示・記録しない）。UI26/型/lint/build・ローカルbrowser4ケースPASS、i8kvltx12へPreview配置。根本原因はUNCONFIRMED、実機FAIL維持、新hostのCookie/Share/callbackは別承認待ち。

両test契約canceled、最終Cookie/転送終了、旧共有停止。iPhoneアカウント/通常sessionを調査用に保持。再送連打なし、本番変更NONE。テストfixture初回はSTAGING_TEST不足でbuild参照先不一致、その後は合成エラー応答のAPI-version/CORS公開ヘッダー不足で分類できず、fixtureのみ訂正して再検証。失敗証跡を保存し実サービス不具合と区別。


### 06:48 JST 診断用Previewの承認反映（最新）
本人がi8kvltx12限定のCookie/Share/2callbackを承認。staging Authの戻り先だけ2件追加し6→8、Site URL維持。旧共有を置き換え、新hostの共有をUI確認。短期Cookieはhost-only/Secure/HttpOnly/最大2時間、秘密値をチャット/ログ/docs/Gitへ残さず、Hosted確認後にファイル削除・browser終了。共有リンク値はdocsへ記録せずVercelのCopy Link画面を本人へ引き渡した。iPhoneの1回のreset結果（成功またはAUTH-xx）待ちのため共有は有効。webhook転送は開始していない。

Hostedの明示リンク拒否AUTH-01・ブラウザ情報なしAUTH-05・sessionなしAUTH-07の3ケース、320/390/1440幅PASS、実Auth送信0・uncaught/console/hydration/5xx0。最初はURLのerror拒否をSDKの期限切れ分類AUTH-02と期待したfixture誤りで失敗。callbackDestinationが早期拒否する既存仕様に合わせAUTH-01へ訂正、初回証跡を保持。アプリの認証判定は変更なし。これは診断表示の検収で、iPhoneの根本原因修正・メール復帰PASSではない。NO-GO/in_progress維持。証跡: v2-auth-callback-diagnostic-access.json / v2-auth-callback-preview-result.json。production/live/commit/push/実OpenAI呼出しNONE。


### 2026-10-24 07:13 JST 再設定確認画面の適用（最新、過去の承認待ちより優先）
i8kvltx12で本人報告AUTH-01。06:49:53のverify303と06:50:25の無効/期限切れ403、コード発行後の新sessionなしを照合。最初のアクセスがメール先読みか本人操作かは未確定。原文・IP・認証URLは保存しない（v2-recovery-link-reuse-evidence.json）。

回復メールに明示ボタンの確認画面を追加。tokenはfragmentからメモリだけへ移し、URL/DOM/storage/logへ残さず、設定済みAuth・recovery・同一host callbackを固定。開いただけではverifyせず、クリック1回で既存PKCEへ進む。callbackのinitialize/getSession/getUser必須条件を維持し、既知error_codeだけ固定AUTHコードへ分類。

新Preview b7zdudurb / dpl_AXZpuWpZ84qhme9QNVXe3fdUCZYx READY。source eafb75e+未commit、SHA256 0418fb2302c49a8cd391010fac3fd59ed5b9b6538b7e27f03a2150f2068635cb。本人承認後に新host限定Cookie・共有置換・staging callback2件（8→10）・exact RedirectTo限定のReset password本文を適用。保存/再読込をUI確認、他hostは既存ConfirmationURL。i8共有は置換で失効。新共有値を出力/保存せずCopy Link画面を引き渡した。

検証: offline UI32/URL境界21/型/限定lint/build PASS、実SDK+合成Auth5ケース（先読みcontext送信0、本人クリックverify1/PKCE交換1、challenge一致）、320/390/1440幅/axe0 PASS。テストfixtureの旧ES5 transpileではiterable処理が失敗しES2022へ訂正、アプリ認証は緩和なし。Hosted4ケース/3幅/axe0、Auth送信/console/hydration/uncaught/5xx各0 PASS。秘密検査1206 files/107 bundlesの既知secret一致0。自動検収Cookie削除/browser終了。転送・実OpenAIは開始していない。

iPhoneの新メール条件分岐・確認画面→明示ボタン→password変更→旧拒否→新login/reloadは本人結果待ち。実機PASSに先取りしない。本番NO-GO、AI_TASK in_progress維持。両test契約canceled、Android退会PASS、既存停止は維持。共有と2callback/限定templateだけ実機待ちで保持し、終了後共有停止。production DB/Auth/deploy/migration・Live課金・commit/push/main merge NONE。

証跡: v2-recovery-confirmation-access.json / v2-recovery-confirmation-preview-result.json / V2_AUTH_RECOVERY_PREFETCH_REVIEW.md。主変更: app/auth/confirm/page.tsx、lib/emailConfirmation.ts、lib/authCallbackStatus.ts、app/auth/callback/page.tsx、関連UI/browser検証scriptsと証跡。次はiPhone1回の本人検収・必要なら最新メール構造だけ安全に照合し、最終cleanupと無料公開可否を再判定する。


### 2026-10-24 07:21 JST 最終実機PASS・検収終了（この節を最新判定とする）
本人がb7zdudurbの再設定確認画面→明示ボタン→新password設定→logout→旧拒否→新login/reloadを全完了。新sign-inをREAD ONLYで確認。その後の本人logoutとsessions0/有効refresh0を照合。初回signup/旧resetのFAILは履歴保持、signup自動復帰を再検収したとはしない。

Vercel共有をOnly people with accessへ戻して保存をUI確認。自動検収Cookieなし、browser終了、一時forward/retirement/diagnostic process0、両test契約canceled。既存AI/intake/worker OFF。端末に残る発行済みaccess JWTの即時失効やブラウザCookie遠隔削除を主張しない。stagingのexact b7 callback2件と条件付きReset templateは承認済み設定として保持。

判定: **FREE V2 CONDITIONAL GO / Mode B**、Full V2 NO-GO。必要条件は本番実施承認・検収source固定、移行直前の整合backup、042〜059の依存順移行/段階別確認、本人Owner監査付きbootstrap、別承認の本番host Auth設定とsignup/recovery smoke、監視/復旧担当。AIとLive BillingはOFFを維持。詳細v2-production-free-final-verdict.json。今回production/commit/push/deploy/main merge/実OpenAI NONE。

検証は既存PASSを再利用し、今回はJSON整合性・diff check・38既適用migration hash一致・READ ONLYの限定metadataのみ追加。残るAI/有料法務/Live/原価は有効化の別ゲート。未確認のmanaged復旧/別端末鍵/段階HTTPを成功扱いしない。本番移行の具体的承認へはMode B限定で進める。
