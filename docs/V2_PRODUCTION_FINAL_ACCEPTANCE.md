# V2 Production Final Acceptance

## 最新: 2026-10-24 V2 PRODUCTION COMPLETE / V2 FREE LAUNCH

本人f42d38a4の明示承認により、最終実機signup/reset未完了をKnown Riskとして受容し、本番反映を完了。AI・Live Billing・synthetic productionはOFF。一般書込OPEN、Owner1、退会ON、Buffer送信の意図的OFF・元scheduler/cronを維持。042-059の18migration、既存hash/backup/restore、本番共同制作smoke・Security・26追加表RLS・退会保持/削除・Admin・Buffer状態確認PASS。

Owner初期化の既存資格台帳との接続漏れは、本人の2件限定承認後に監査付き補完し非表示/復帰PASS。TEST Owner無効化/資格除去/session0、実Ownerのみ保持。RLS・GRANT・関数定義の変更なし。

main/release/v2-rc1: ca1b589へff-only統合・push、正式tag v2.0.0。Git自動本番deployment READY/canonical一致、主要11経路200、Pricing準備中。初回monitor alerts0、heartbeat v2-24が10/25 22:45 JSTまでACTIVE。詳細・復旧条件・証跡はV2_FREE_LAUNCH_RESULT.md。

未解決Known Risk: 最新本番Android/iPhoneの登録・再設定メール復帰は未再検収でPASSではない。メール2本文は本番保存/readback済み。Real OpenAI verification pending（過去の限定応答試験を否定する意味ではなく、本番機能ONの検収は未完）；Live Billing not enabled。Managed Auth/SMTPログ自動収集、別端末でのbackup復旧、常時有人監視は未提供。AI/有料法務・価格・Stripe live運用は有効化時の別ゲート。

以下は移行前の履歴。古いNO-GO/本番未変更の記述を現在の状態として使用しない。

Updated: 2026-10-24 07:21 JST。判定: **FREE V2 CONDITIONAL GO（Mode B）**。
本番移行の可否を判定する検収記録。本番反映の承認ではない。

## 結論
本人が修正版b7zdudurbでiPhoneの確認画面→明示ボタン→新password設定→logout→旧拒否→新login→reloadの全手順完了を報告。READ ONLYで新しいsign-inを照合し、その後の本人logoutでsessions0/有効refresh0を確認。Androidの既存PASS、両端末test決済、Android退会と併せ、今回の必須実機条件は達成した。初回signup callback FAILと旧reset失敗は履歴として保持し、signup経路の再検収を実施したとはしない。

**Mode B: FREE V2 CONDITIONAL GO**。AI OFF・Live Billing OFFの人間共同制作を推奨。Ownerは本人指定・手順検証済みでREADY（本番付与は未実施）。無料規約方針は採用済み。切替の承認、整合backup、042〜059移行、本人Owner限定smoke、本番hostのAuth設定とsignup/recovery smokeが満たされるまで一般公開しない。検収済みコードには未commit差分があり、source manifestを含めて固定する。

Mode A（Full V2）は実AI Draft E2E/費用上限、価格credit確定、有料法務、Live adapter/Stripe準備が残るためNO-GO。Mode Cは上記切替条件を満たせない場合に選ぶ。本記録は本番実行の承認ではない。詳細判定はv2-production-free-final-verdict.json。

## RC
- Branch: release/v2-rc1。Tag: v2-rc1。開始時HEAD: a4cbb247f708f2020e07b6e6d60ad120700dd064。
- Application source: 1523476c801ccbddabd5257714da6bc5a727c80d。AI参照schemaだけを修正、RC commit eafb75ec5f374d2dbdb2655d81576d4efe772c6d。migration変更なし。
- Git main ref: ff1fe59406fdf3fdcf49a35c16e7e0fec413de7a。本番基準402719b12a5c41f77656f3715e7bef5e87d6baa8のancestorであり、別途mainへ統合していない。以前の402719bをmainと記した箇所は本番基準の意味に訂正。
- 実機確認用RC Preview（UI不変）: https://minnade-tsukuru-staging-ouzrmgsei-sonetokiyas-projects.vercel.app
- Deployment: dpl_Har9vYnUeGSiWa7gcMSDp4buzsRA。Vercel APIとDashboardで最新Preview/READYを再確認。
- 修正版Preview: https://minnade-tsukuru-staging-gt5g3hmxp-sonetokiyas-projects.vercel.app （eafb75e / READY）。
- Commit: AI blocker fix eafb75e。staging Previewのみ配置。push/main merge/production deployなし。検収スクリプトと文書は作業中。
- 3134adb2修正版: https://minnade-tsukuru-staging-jrvv8pum3-sonetokiyas-projects.vercel.app / dpl_hH9sCXbf5bnCkPzjDq34atMq274z READY。eafb75e + 未commit変更、配信用210ファイルのmanifest SHA256 c6e6147d2379deef21f03cd8bdc254c7536c812488977b437445da1937133214。再同意の説明を補う前の8s3klk6rtは検収に使っていない。

## Real OpenAI: PASS（限定された実応答・DB検査）/ AI ON判定は保留
本人の利用可能・自動チャージOFF確認後、累計8回で終了。Greeting1、初回質問失敗1、原因診断1、修正後の通常質問/要約/長めの整理3、ドラフト出力1、公開時整理1。429は今回観測なし。生応答・promptは保存しない。
診断で、未Highlight投稿をhighlightNotesが参照したためvalidatorが正しく拒否したと確認。生成schemaにも同じルームのref allowlist・Highlightのみのref・list/ref上限・非draft時の空文字制約を追加。既存validator/DB検査は緩めていない。AI unit59件、型、関連lint、build、秘密値検査PASS。
Greeting、質問、要約、整理、公開時整理は実応答→schema→staging finish PASS。ドラフトは共有合成Freeアカウントが49/50消費済みで通常依頼が拒否されたため、台帳を増額せず、同じsafe contextからの実応答と読み取り専用DB validatorだけPASS。手動ドラフトのreserve/finish/採用E2Eは今回未完、従来synthetic証跡とは区別する。
公開時整理後のTEST snapshot1件、公開前の非参加者拒否、AI停止後のclaim拒否を確認。AI停止を元へ復元、検収セッション終了。Hosted Previewはsynthetic構成のまま。本番AI呼出し0、課金設定変更0。
証跡: v2-production-real-ai-result.json / v2-production-ai-diagnostic.json / v2-production-real-ai-fixed-result.json / v2-production-real-ai-final-result.json。途中失敗も保持。

## AI Cost / Pricing / Credits
モデルはgpt-4.1-mini-2025-04-14。各種1サンプルのみ。input/output tokens、時間、推計USD:
- Greeting: 572/99、2,551ms、0.0003872。
- 通常質問: 773/220、2,720ms、0.0006612。
- 要約: 777/217、2,534ms、0.000658。
- 長めのログ整理: 2,713/368、4,351ms、0.001674。
- ドラフト出力契約: 2,718/422、3,884ms、0.0017624。
- 公開時整理: 2,693/375、2,873ms、0.0016772。
診断1件を含む計測済み7回はUSD 0.0074388。初回失敗1回のusageは未保存であり、全請求額ではない。入力contextは短文412文字/長め2,611文字であり、最大入力・長期平均・premium品質を保証しない。
Pricing recommendation: **BLOCKED BY INSUFFICIENT DATA**。Free0円、Plus780円/月・7,800円/年、Pro1,980円/月・19,800円/年、50/500/2,000 creditsを自動変更しない。
今回の最大実測manual単価（通常質問1credit）を単純に当てると、50/500/2,000 creditsはUSD0.03306/0.3306/1.3224。ただし失敗再試行・入力長増加・異なるモデル・税/為替/infraを除く短いサンプル試算であり、safeとは認定しない。system AIはmanual credit外で、今回の公開整理単価を24回/日×30日と仮定するだけでもUSD1.207584/room-monthとなる。多数roomの合計予算/停止閾値を加味した悪用・infra余裕の判断が必要。
料金出典は[OpenAI公式モデル資料](https://developers.openai.com/api/docs/models/gpt-4.1-mini)（input0.40/M、output1.60/M USD）。Stripe国内カード3.6%とBilling0.7%の単純合算4.3%のみを控除する参考値は、月払いPlus746.46円/Pro1,894.86円、年払いの月換算622.05円/1,579.05円。税・為替・追加費用・契約差を除く。[Payments](https://stripe.com/jp/pricing)、[Billing](https://stripe.com/jp/billing/pricing)。詳細集計: v2-production-ai-cost-result.json。

## Android / iPhone: 必須実機PASS（以下の初回FAILは履歴）
最新の修正版b7zdudurbではiPhoneの確認画面・新password・旧拒否・新login/reload PASS。その後logout・sessions0/有効refresh0も確認。以下は初回失敗からの経過で、最新結果を上書きしない。

当時のjrvv8pum3の追加ラウンド: Android新規登録・確認メール復帰・login/reloadは本人報告PASS。iPhoneは確認リンク後に「認証リンクを確認できませんでした」。初回READ ONLY照合では両方email confirmed、Android sign-inあり、iPhone sign-inなし。その後の通常Safari loginは本人報告とmetadataの双方でPASS。メール確認とsession確立を区別し、初回リンクを開いたbrowser・失敗原因は未確定。通常login成功をメール復帰成功とは扱わない。同じ通常Safariでresetメールを1回送り、元のSafariへリンクを直接開く再検収を依頼中。証跡: v2-final-device-email-result.json。

両端末の物理test決済→return→Plus/500credit→reloadはPASS、各test契約1件・現期間付与1行を照合。Androidは本人操作の退会完了→再読込で編集不可→旧password login拒否もPASS。READ ONLYでjob completed、Auth/profile/public profile/AI profile各0、billing canceled/deletion confirmed/owner NULL、Auth API404を確認。Stripe側も対象1契約canceled、解約通知1/1成功。作品/投稿/添付0の使い捨て対象であり、内容保持は既存合成E2Eの別証拠。v2-final-device-payment-result.json / v2-final-device-retirement-result.json参照。

06:15 JSTに退会窓終了。全停止flagsを元へ復元、他26job不変、active lease0。一時Cookie/locks削除・転送CLI/HTTP終了・合成Owner session signout。iPhone人間session/test契約・最新Shareと2callbackだけはメール復帰確認中につき保持し、終了後cleanupする。以下は以前の基本導線ラウンドの記録であり、上記が最新状態。
両端末でlogin/Home/Rooms/Pricing/My Page/reload、公開同意・文章/画像投稿、Core申請1件、承認後のHighlight、ドラフト保存/再読込、AI停止案内、logout→loginが本人報告PASS。
最初の作品対象は以前の運営検収でis_hidden=trueだったため、この状態を変更せず公開済み合成作品へ訂正。訂正後の作品タイトルと制作ログの閲覧も両端末で本人報告PASS。初回の対象選定ミスと新Preview失敗証跡は保持。
Plus月払いのStripe test表示・カード入力欄・支払わずアプリへ戻る、退会の保持/匿名化説明も両端末で本人報告PASS。依頼した端末確認ラウンドは終了。
旧基本導線ラウンドでは物理決済確定・退会完遂・メール復帰を実施していなかった。最新ラウンドの追加結果は上記と専用証跡に記録し、過去の自動検収と区別する。
実機はUI不変の旧RC固定Preview（1523476）、AI修正eafb75eは新Previewで関連6checks PASS。HTML/assets18件の秘密一致0、一時Cookie削除、検収browser終了、合成Creator session signout済み。今回Webhook転送は開始なし。
実機用Shareable Linkは両端末の確認後、対象deploymentだけをOnly people with accessへ戻して共有停止をUIで確認。tokenはdocs/Gitへ保存しない。利用者の端末内に残るCookieや通常のstagingログインsessionを遠隔削除したとは主張しない。

## Legal: FREE POLICY ADOPTED / Paid BLOCKED
本人が3134adb2案を採用し、Terms/Privacy/再同意表示を2026-10-24へ更新。059はstagingのみ適用、既存の同意は自動更新していない。同意DB9 checks、型/lint/build PASS。localhost + staging合成利用者の明示再同意9 checks（未選択拒否・保存・reload・5幅・axe0）、Hosted同意保持/文面5 checks PASS。特商法表示・税込/税別・更新/解約/返金/grace/credit失効等を確定するまで有料開始不可。専門家確認推奨を法的適合性の確定と混同しない。
詳細: V2_PRODUCTION_LEGAL_CHECKLIST.md。

## Stripe Live: NOT READY / Live Billing: OFF
接続済みStripeの2アカウントはどちらもtest。事業者確認、live商品/価格/portal/tax/payment method/恒久Webhookは未確認・未作成。現adapter/DB providerはtest専用で、キーの差替えだけではlive対応しない。

## Owner: DESIGNATED / NOT GRANTED
本人が既存本番user ID 820ed99a-286e-4f96-95da-a66988139415をOwnerとして指定済み。V2_OWNER_RELEASE_PROCEDURE.mdに監査付き・重複なしのbootstrap手順を作成。staging transactionで6 checks PASS、全行ROLLBACK。本番権限付与・Ownerログイン/停止操作検収は未実施。手順準備READYと本番運用開始を区別する。

## Latest Backup: PASS（範囲限定）
2026-10-24 03:31〜03:34 JST、production joedeuyrzimqyjapqpyhから読み取り専用DB snapshotとStorageを取得。
DB 78表、Storage 19 objects / 6,270,619 bytes。DB archive SHA256 06e85f50a46e6058da3fc8105369ea6c272a963dd95f3390a7b5dffb891dc49e。
秘密・実データはGit外の暗号化artifactのみ。DB変更なし。Storage取得前後のmetadata一致。
書込を停止していないため、DB/Auth/Storageを跨ぐ完全に同時の復旧点は保証していない。実際の移行直前には入口停止・in-flight整理後に新しい保全が必要。
証跡: v2-production-backup-result.json。

## Isolated Restore: PASS（範囲限定）
実backupをlocalhostの隔離PostgreSQLへ復元。78表、396構造、RLS/実効ACL/FK/Trigger/Function/Index、Storage19件の暗号化解除・hash照合を確認。
初回105 checks PASS。今回059の追加だけを理由に同じ暗号化backupを再利用して補完、106 checks PASS。初回ACL正規化、PG17→18のNOT NULL catalog差、公開snapshotの正当なSELECTを誤拒否した検収条件を訂正。失敗証跡attempt1〜3を保持。
pg_cron/http/pg_net/Vaultは外部通信しないcontractを使用。managed Auth/Storage API、Vault鍵/SMTP/OAuth設定、別Windows端末でのDPAPI復旧を証明したものではない。
検収後は隔離server停止、平文archiveとcluster削除を確認。

## Migration Rehearsal: PASS（DB範囲）
本番適用38ファイルのhash一致を再確認。combined SHA256 62c7f4e7fec1494b4080a901ccd0adf5e05cec7ac2718bae978a206b0c9657ed。
実snapshot cloneへ未適用042〜059の18件だけを順に適用。036/040/041はhistorical/staging testで対象外。059の現在同意版・既存profileの非更新も確認。
各段階で既存78表の元column値/件数fingerprint、旧MVP/Buffer RPC signature、新表RLS/直接DML境界を照合。最終22新public表。既存roomはV2化しない。Ownerを自動付与しない。
HTTPアプリを実cloneへ接続した途中段階の操作検収ではない。旧アプリ互換性の全保証とはしない。
証跡: v2-production-restore-result.json（初回）/ v2-production-restore-059-result.json（今回の追加版）。

## Security / Account deletion / Admin / Buffer
既存RCのSecurity/RLS、staging退会、運営、Buffer回帰PASSを再利用。詳細はV2_RC_ACCEPTANCE.md。今回productionでは運営停止・Auth/Storage・課金・Bufferを変更していない。
P1だった本番Free billing退会前処理の未接続を修正。UI OFFでも既知schemaを検査し、旧MVPのmissing RPCだけ互換許容、V2期待時/不明provider/確認失敗は停止。billing stopを最終prepare/Storageより先行しAuth直前に再確認（受付時の既存名義整理は変更なし）。52境界checks、退会関連4 suites PASS。実staging Free退会はproduction環境分岐を使うtransaction内6 checksで確認してROLLBACKし、Auth/Storage API実削除は行っていない。実機の完遂は別条件。

承認済みの本番Free gateは正確なproject・production環境・free指定・schema58・V2フラグを全て要求。管理は更にADMINフラグ、既存の本人認証/DB Owner・Moderator/Origin/監査を必須とする。AI/Stripe production拒否は維持。schema58は運営側のfoundation指定値であり実DBを自動判定する値ではない。059と文面2026-10-24も切替え前に照合する。

## Feature Flag Plan（未適用）
現時点は本番現状維持。無料先行候補はV2 UI ON、AI OFF、Live Billing OFF、AdminはOwner bootstrap後の限定検収でON。退会はUI flagに依存せずschemaの整合性処理を継続する実装済み。Buffer/既存cronは元の運営状態を保持する。

## 残条件（過去の進捗記録。最新判定は冒頭と末尾）
1. 修正版Previewの関連6 checks、同意保持/文面5 checks、26配信素材の秘密一致0、未認証admin401とtest決済境界・退会停止を確認済み。完了操作の実機検収へ進む。
2. 両実機Plus月払い確定→return→Plus/500credit→reload、Androidの退会完遂・旧login拒否はPASS。各現期間500付与1行。決済通知6件中2成功/4retryableで全配送成功は主張しない（DB pending0・状態収束、正確な原因未確定）。残る実機blockerはiPhoneメール復帰: 同じSafari別タブでもreset2回FAIL、両メールの戻り先は正しい。秘密のない固定確認コードを追加、UI26・ローカル実SDK別タブ等4ケース・型/lint/build PASS。i8kvltx12は診断用Previewであり根本修正の完了ではない。本人の最新host限定3件承認後、i8kvltx12の短期Cookie・共有・staging callback2件を設定。Hosted診断表示3ケース/3幅PASS、実Auth送信0。自動検収Cookie削除/browser終了、共有だけiPhoneの1回の診断検収待ちで維持。両test契約は解約済み、最終転送/Cookie終了、旧共有停止。iPhoneアカウントと通常sessionは診断用に保持。
3. Owner手順は準備済み。本番切替時に指定本人のbootstrapと限定smokeを別承認で行う。無料方針の再承認は不要。有料法務・AI条件は引き続き別判断。
4. AI ONには手動Draftの残検収、最大入力/実使用原価と予算条件の判断。INVALID_OUTPUTは今回の修正と限定実応答で解消。Live ONには法務・live adapter/DB/Stripe設定の別リリース。
5. 移行直前の停止・整合backup、managed service復旧条件と段階別HTTP smokeの実施担当を確定。

Production Changes: **NONE**。
Next（更新）: Mode B限定の本番実施承認へ進める。iPhone再設定と最終cleanupは完了。切替条件・未commit source固定・本番Auth smokeを承認範囲へ含め、未承認のまま反映しない。既存PASSは再実行しない。staging既存26job（pending15を含む）は不変、active lease0・関連cron0。退会フラグは元のOFFへ復元済み。production変更は禁止を維持。


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
