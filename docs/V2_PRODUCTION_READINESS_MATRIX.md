# V2 Production Readiness Matrix

## 最新: 2026-10-24 V2 PRODUCTION COMPLETE / V2 FREE LAUNCH

本人f42d38a4の明示承認により、最終実機signup/reset未完了をKnown Riskとして受容し、本番反映を完了。AI・Live Billing・synthetic productionはOFF。一般書込OPEN、Owner1、退会ON、Buffer送信の意図的OFF・元scheduler/cronを維持。042-059の18migration、既存hash/backup/restore、本番共同制作smoke・Security・26追加表RLS・退会保持/削除・Admin・Buffer状態確認PASS。

Owner初期化の既存資格台帳との接続漏れは、本人の2件限定承認後に監査付き補完し非表示/復帰PASS。TEST Owner無効化/資格除去/session0、実Ownerのみ保持。RLS・GRANT・関数定義の変更なし。

main/release/v2-rc1: ca1b589へff-only統合・push、正式tag v2.0.0。Git自動本番deployment READY/canonical一致、主要11経路200、Pricing準備中。初回monitor alerts0、heartbeat v2-24が10/25 22:45 JSTまでACTIVE。詳細・復旧条件・証跡はV2_FREE_LAUNCH_RESULT.md。

未解決Known Risk: 最新本番Android/iPhoneの登録・再設定メール復帰は未再検収でPASSではない。メール2本文は本番保存/readback済み。Real OpenAI verification pending（過去の限定応答試験を否定する意味ではなく、本番機能ONの検収は未完）；Live Billing not enabled。Managed Auth/SMTPログ自動収集、別端末でのbackup復旧、常時有人監視は未提供。AI/有料法務・価格・Stripe live運用は有効化時の別ゲート。

以下は移行前の履歴。古いNO-GO/本番未変更の記述を現在の状態として使用しない。

最新判定: **FREE V2 CONDITIONAL GO（Mode B）**。iPhone再設定PASS・検収共有/session終了。Full V2はNO-GO。本番実行承認は別途必要。v2-production-free-final-verdict.json参照。

Updated: 2026-10-24 JST。総合 **FREE V2 CONDITIONAL GO**（Full V2はNO-GO）。詳細と根拠はV2_PRODUCTION_FINAL_ACCEPTANCE.md。

## Technical — LOCAL BLOCKER FIX AND RELATED PREVIEW PASS
本人承認後、本番Free限定gate・管理・UI OFFでも動く退会整合性を一体修正。52境界checksと関連11群PASS。localhostの明示再同意9、Hosted同意保持5/人間操作・AI停止6、配信素材26件の秘密一致0。移行時のproduction HTTP smokeは未実施。

## Security — RC PASS / LOCAL PRODUCTION BOUNDARY PASS
fresh334、実staging metadata46、新26表RLS/直接DML、既存MVP21 suites/Buffer238を再利用。本番条件の欠落/取り違え、未認証401/非staff403、Origin、AI/Stripe拒否をローカル検証。実productionの権限検収ではない。

## AI — SCOPED PASS / AI ON PENDING
実API累計8回、生成ref制約を修正。Greeting/質問/要約/整理/公開整理はDB保存までPASS。Draftは実出力+DB validatorのみ（残credit1、台帳増額なし）。各1原価サンプルでpricingはINSUFFICIENT DATA。AI停止復元済み。

## Mobile — REQUIRED FLOWS PASS / RECOVERY RETURN PASS
最新: b7zdudurbでiPhone再設定全手順PASS、最終logout後sessions0/有効refresh0。以下の初回失敗・結果待ちは過去の検収段階として保持する。

以前の両端末の主要ナビ、投稿/画像、Core、Highlight、Draft保存、AI停止案内、訂正後Work/log、logout/login、Stripe test画面/戻り、退会説明が本人報告PASS。最新jrvv8pum3では両端末test決済完遂とAndroid退会完遂もPASS。メール復帰はAndroid PASS / iPhone初回FAIL。iPhoneの確認メール処理・その後の通常Safari loginはREAD ONLYでも確認済みだが、初回callback失敗原因は未確定。同じSafariでresetメール復帰を1回確認する結果を待つ。通常loginとメール復帰を区別する。

当時のcleanup（最終結果は末尾）: 決済/Android退会の両転送窓を終了、Cookie削除・合成検収session終了・全停止flags復元・既存他26job不変を確認。最新Share/2callbackとiPhoneの人間session/test契約は最後のメール検収待ちで保持。元のFAILをPASSへ書換えない。

## Billing — TEST PASS / LIVE NOT READY
test Checkout/Webhook/plan/cancel/failure/grace/credit/deletionは既存RC PASS。Live adapter・provider schema・決済環境は別ゲート。Free accountの退会前処理も必要。
最新実機は両端末決済完遂/Plus500/reloadが本人報告PASS、Stripe connectorとREAD ONLY DBで各test契約1件・active・現期間500付与1行を確認。通知6中2成功/4retryable、pending DB event0で状態収束。全配送成功とはしない。Androidはその後の実機退会でStripe test契約canceledを確認。iPhone契約も後続cleanupで解約済み。決済/退会の転送は終了。

## Account deletion — ANDROID PHYSICAL PASS / PRODUCTION NOT RUN
本人が退会完了・再読込後編集不可・旧password login拒否を報告。READ ONLYでjob completed、Auth/profile/public profile/AI profile各0、billing canceled/deletion confirmed/owner NULL、Auth API404を確認。解約Webhook1/1成功、Stripe test契約1件canceled。他26job不変、active lease0、全停止flags復元。内容0の使い捨て対象のため、作品/使用済添付保持は既存合成E2E証拠と区別。iPhone退会は未実行（要件の少なくとも1端末は達成）。

## Legal — FREE POLICY ADOPTED / PAID BLOCKER
本人が3134adb2案採用。Terms/Privacy/再同意2026-10-24、059staging適用・DB9 checks PASS・既存同意backfillなし。local/Hosted表示・保存検収PASS、5幅横overflowなし/axe0。特商法事業者情報はHUMAN INPUT REQUIRED、有料表示未確定。PROFESSIONAL REVIEW RECOMMENDED。

## Backup — PASS scoped
2026-10-24 03:31〜03:34 JST、実DB78表/Storage19件を暗号化。書込停止なしでcross-service atomic snapshotではない。release直前の再取得が必要。

## Restore — PASS scoped
059追加分を同じ暗号化backupで補完し106 checks PASS。DB/RLS/実効ACL/構造とStorage hash。managed services・外部資格情報・別端末の鍵復旧は未検収。隔離server/平文cleanup完了。

## Migration — PASS DB rehearsal / HTTP PENDING
38本番適用hash一致。実snapshot cloneへ042〜059の18件適用、各段階で既存row hash/旧RPC signature/新public RLS/直接DMLを確認。059は同意版更新のみ、既存行の同意自動更新なし。managed extension contract使用。prod変更0。

## Admin — PROCEDURE READY / PRODUCTION GRANT NOT RUN
Owner本人指定済み。監査付き冪等bootstrapをstaging transaction内6 checksで確認、全行rollback。V2_OWNER_RELEASE_PROCEDURE.md参照。本番権限付与0。移行時の限定検収を別承認で行う。

## Operations — PENDING
本番Owner、変更時間、復旧担当、同時点保全、監視/SMTP確認を確定。旧app rollback時もV2 billing recordの退会整合性を保つ。Bufferを自動再開しない。

## 06:42 JST 最新追加結果（上記の結果待ちより優先）
iPhoneのresetメールは同じSafari別タブで2回ともFAIL。メールのstaging Auth・jrvv8pum3・reset戻り先は一致、2回ともサーバーのコード発行時刻あり。原因未確定。ローカル実SDK/合成Authでは別タブ成功・情報欠落/不一致/期限切れを区別できた（4ケース）。秘密のない固定確認コード表示だけを追加、UI26・型/lint/build PASS、診断Preview i8kvltx12を配置。実機の原因解消とはしない。本番はNO-GO。

Android退会後に残ったiPhone test契約も解約、署名通知1/1成功・DB canceledを確認。Cookie/forwarding終了、旧jrvv8pum3 Share停止。iPhoneアカウント/通常sessionと旧callback許可は診断継続用に保持。新PreviewのCookie/Share/callback2件は新host限定承認待ち。

## Environment separation
- Supabase staging fwqucffxdmbdczspkcyr / production joedeuyrzimqyjapqpyh。正確なrefを操作前に照合。
- Vercel検収はminnade-tsukuru-staging。旧基本実機/AI修正の固定Previewは過去証跡として維持。今回の改訂文面/退会修正版はv2-rc-preview-deployment.jsonにURLと未commit source digestを記録。本番deployなし。
- OpenAIはstaging専用既存キー、本人の利用可能確認後のみ。自動チャージ設定を変更しない。Preview synthetic / 実AIは限定ローカルrunner。
- Stripeはtest sandboxのみ。Live key/Live webhook/実課金は禁止状態を維持。
- Buffer、cron、退会workerは既存の運営停止を保持。検収で一時変更したAI controlは元へ復旧。
- 秘密値、認証URL、本文、共有tokenをdocs/Gitへ保存しない。


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


### 2026-10-24 14:50:59 JST 本番登録メールの実機FAILにより切替停止（最新）
本人が本番の確認メールで「認証リンクを確認できない」と報告。指定使い捨てアカウントのREAD ONLY照合でemail confirmed=true、PKCE s256/code発行あり、初回検査のsign-inなし/session0。その後本人の通常password login完了とDB sign-inあり/session1を確認。通常login成功をメールcallback PASSにしない。再送・再設定・本人credential代理入力は行っていない。実際にメールを開いたbrowser/webviewは本人回答に記載なく未確認。先読み/再使用/ブラウザ状態差を原因と断定しない。

検収済みRCの確認画面はrecovery限定で、signupのメール経路には適用されない。新しいV2 migrationだけで登録メールの失敗が直るとは判断しない。本番移行の条件が不成立のためNO-GO。production停止/042〜059/Owner bootstrap/deploy/Auth設定は未実行。旧MVPを継続し、不要なmaintenanceを開始していない。本人が作った検収accountと通常sessionは存在するため、ユーザーによる本番操作も皆無とは表現しない。AI/Live OFF、commit/push/deployなし。

証拠: v2-free-production-signup-failure.json / v2-free-production-release-status.json。従来のMode B conditional GOはv2-pre-release-conditional-go.jsonへ保存し、現final verdictを本番signup FAILのNO-GOへ更新。コード固定、106+11隔離検証、production env照合、配信コピー準備の完了は保持。直前backupは実際の切替時に新規取得が必要で、過去snapshotを直前backup扱いしない。次はsignupメール復帰の原因特定/必要修正/同一端末実機再検収後にsourceを再固定し、承認済み移行へ戻る。
