# V2 Production Legal Checklist

Updated: 2026-10-24 JST。法的適合性の確定ではなく、実装と現行表示の差分確認。
**無料V2: 本人が3134adb2案を採用、文面・DB再同意準備READY、local/Hosted表示・保存PASS。有料V2: BLOCKER / Live Billing OFF。** 以下の採用前チェックは検討履歴。最新判定は末尾の採用記録を優先。

## 無料V2の本人レビュー
- HUMAN REVIEW REQUIRED: 利用規約の旧Core退出制限（参加後5分等）とV2の退出/承認処理、supporter/Member用語を整合させる。
- HUMAN REVIEW REQUIRED: ルーム参加時の公開範囲、制作ログ、期限での完成作品公開、公開撤回/非表示の意味を画面と規約で一致させる。
- HUMAN REVIEW REQUIRED: 退会後も共同作品・公開snapshot・制作履歴を保持する範囲、公開名義の匿名化、実名/ペンネームの選択、通報/監査/backupの保持期間と削除例外を具体化。現在の一般的な「一定期間」を実運用の期間として確定扱いしない。
- HUMAN REVIEW REQUIRED: 問合せ先・通報・異議申立ての対応担当と時間目安。18歳以上、禁止事項、連絡先の既存表示は確認できるが運用体制を自動認定しない。
- PROFESSIONAL REVIEW RECOMMENDED: 個別著作権、共同著作物、素材ライセンス、編集・公開許諾、外部利用禁止と運営宣伝利用許諾の範囲、退会時の許諾継続、第三者権利侵害時の扱い。

## AI / Privacy
- HUMAN REVIEW REQUIRED: AI Creatorである表示、人間の最終判断、出力の誤り・非保証、他ユーザーの投稿や公開予定素材を外部AIへ送ることへの説明。
- HUMAN REVIEW REQUIRED: Privacyの委託先一般列挙だけで足りると判断しない。OpenAI/Stripeへ送るデータ項目・目的・保管・国外取扱い・停止時の挙動を実構成に照合し、必要な表示と同意をレビュー。
- PROFESSIONAL REVIEW RECOMMENDED: 出力著作権、学習/保存条件、共同作者の権利、個人情報の国外提供等の適用判断。providerのstore:falseとローカルの本文非保存だけで全法的義務を満たすとはしない。
- BLOCKER for AI ON: 実AIの限定実応答は確認できたが、手動Draft E2E・費用上限の判断が残る。UI/規約で成功や品質を保証しない。OFFで公開する場合はAI停止中の説明を用意。

## 有料サービスの表示と決定事項
以下は全て有料本番開始前のBLOCKER。現在の将来課金の一般条項だけでは最終確定していない。
1. 運営事業者の正式名称、住所、電話番号、責任者等の必要表示と、適法な省略・請求時開示の適用可否。
2. 円表示、税込/税別、年額の総額と月換算の区別、追加費用、支払方法/支払時期、提供開始時期。
3. 自動更新の周期、契約期間、更新停止期限、解約操作、当期accessと次期料金、downgrade予約の効力。
4. 返金方針。原則中途返金なしの候補を法定の権利・誤請求・重複・サービス未提供時まで一律免責としない。
5. 決済失敗、grace期間、Freeへの切替、復旧、paid AI設定の保持/ロック/再購読時復元。
6. credit数、各操作の消費量、予約/確定/失敗解放、付与時期、有効期間/繰越、月額と年額、Creator共有/Core消費、自動AIの例外。
7. 最終申込画面での金額・数量/期間・自動更新・解約条件・申込みの意思確認。test Checkout PASSだけで法的表示PASSにしない。
8. 価格/creditの本人決定と費用計測。現在はINSUFFICIENT DATA。実際に購入不能な状態では有料購入可能と誤認させない。

[消費者庁の通信販売の説明](https://www.no-trouble.caa.go.jp/what/mailorder/)と[広告表示に関するQ&A](https://www.no-trouble.caa.go.jp/qa/advertising.html)を基に確認項目化。個別の義務・例外・文面は本人および必要に応じ専門家が確定する。

## Stripe Live readiness（実施しない計画）
- NOT READY: live accountの事業者情報/本人確認、入金先、利用可能決済方法、明細表記、顧客問合せ先を本人が確認。
- NOT READY: live Plus/Pro monthly/yearlyの4価格、税設定、Portalのplan変更/cancel制限、返金担当・権限。
- NOT READY: production用恒久Webhook。checkout.session.completed、customer.subscription.created/updated/deleted、invoice.paid/payment_failed等の必要eventを現handlerと照合し、署名・重複・順不同・再試行・古いevent・不明customerを検収。
- NOT READY: 現DB/providerはstripe_test/synthetic専用。live化は専用境界設計、schema/adapterの別reviewが必要。test secretの名前を置換するだけでは不可。
- Secretsはserver専用、test/live分離、値をGit/ログ/ブラウザへ出さない。Webhook署名secretはAPI keyと別管理。
- 今回live Product/Price/Webhookを作成しない。productionの課金設定を変更しない。
[Stripe本番アカウント設定](https://docs.stripe.com/get-started/account/set-up)、[キー](https://docs.stripe.com/keys)、[Webhook](https://docs.stripe.com/webhooks)。

## 公開判断
無料部分の本人採用、production gate/退会整合性のローカル修正、必須実機、Owner手順準備は揃い、無料V2は条件付きGO。移行実施と本番smokeは別承認・別実行。有料法務が未完のままLive BillingをONにしない。

## 3134adb2: 本人が採用した具体的改訂案（2026-10-24文面・同意版へ反映）

### 無料V2 Termsの差替え案
第2条: supporterを「Member（旧supporter）：参加同意後に投稿・素材共有・Core申請ができる参加者」に改める。Creator/Core/運営Ownerは別の役割と明記。

第10条: 「Coreは共同制作の編集を担います。制作中の退出・降格はルームの申請・承認手順に従います。Creatorへ降格を依頼するか、公開後の退出手順を利用してください。退会によって制作中の役割の条件を迂回することはできません。」旧『5分後は原則退出不可』はV2に適合しないため削除候補。既存MVPルームとV2ルームで手順が異なる場合は各画面の表示を優先して説明する。

第9条・第11条: 「参加時に表示する公開範囲を確認してください。完成作品と公開対象として確認された制作ログ・素材は、参加者以外にも公開されます。期限到来時は制作途中でも公開処理の対象になります。運営による停止・非表示は別に行います。非表示は物理削除と同じではなく、発行済みの一時閲覧URLが短時間残る場合があります。」

第9条の2: 「退会受付後は新しい書込みを止め、契約がある場合は停止を確認してから退会を進めます。制作中のCreator/Coreは事前に画面の案内する整理が必要です。共同作品・寄与・使われている添付は共同制作の維持のため保持し、通常の公開名義は退会したメンバーに変更します。作品本文や確定済みの公開記録へ利用者自身が記載した名前・情報まで一括で消去されるものではありません。個人情報・権利侵害の申立ては窓口で個別に確認します。未使用の本人所有添付は安全確認後に整理します。途中失敗時は処理状況を保持して再開し、完了が確認できるまで完了とは表示しません。」

第6条・第19条の無料公開時の説明: 「初回の無料V2公開ではAI Creatorの自動生成・手動生成および有料契約の申込みは提供しません。停止中に合成回答を実AIの回答として表示しません。有料プランの候補価格・利用枠は確定価格ではなく、有料提供開始前に条件を別途明示します。」停止中も利用者が外部AIで作った素材を投稿する場合のルーム規則は存続。

### Privacyの追記案
認証メール/認証記録、プロフィール、投稿/画像/添付、参加同意・役割・制作ログ・公開snapshotを各機能のために処理する。Supabaseは認証/DB/Storage、Vercelは配信、設定済みGoogle SMTPは認証メール送信に利用する。ログイン維持にはCookie/localStorageを使う。各事業者の所在地・処理地域・契約条件を運営者が確認し、必要な国外取扱いの説明を確定する。

AI有効化時は必要なルーム本文・ドラフト・依頼文をOpenAIへ送る。Auth ID/メール/署名URLをcontextへ含めない設計だが、本文に個人情報を入力しないよう案内する。無料V2のAI OFF中はアプリから生成要求を送らない。Stripeは有料化後に契約・決済情報を扱う予定で、カード情報をアプリDBへ保存しない。現在のstagingテスト利用と有料本番提供は区別する。

退会時はAuth/profile、保存AIプロフィールを削除対象とし、共同制作・利用済み添付・公開snapshotは保持する。billingの所有Auth参照はNULL化するが、event hash/処理状態/credit台帳や監査の内部UUIDは残る。監査・通報・セキュリティ記録は必要な運営者だけが参照し、自由記述へPIIを転記しない。これらを『完全匿名化済み』と表現しない。

### 運営者の決定が必要な保持運用
HUMAN REVIEW REQUIRED: 通報・監査・バックアップの具体的保持期間と担当者。推奨は四半期ごとに必要性を見直し、解決済み記録のPIIを最小化し、法定保存・未解決事故だけ根拠を記録して例外管理する。30日/90日等の自動消去は未実装で、採用・実装・検証なしに期限を約束しない。現在のimmutable auditに既存行DELETEを許す変更は今回行わない。

個人情報保護委員会は一律の保存期間を定めず、利用不要になった個人データの消去努力義務を説明している。[公式FAQ](https://www.ppc.go.jp/all_faq_index/faq1-q5-2/)。監査目的だけで無期限保持が正当化されると判断しない。

### 文書別の判定
| Document | Classification | Remaining condition |
|---|---|---|
| Terms | HUMAN REVIEW REQUIRED | 上記V2差分の採用、権利・公開・退会許諾の確認、同意版とDB同時更新の検証 |
| Privacy | HUMAN REVIEW REQUIRED | 取扱先・保持目的/期間/担当、国外取扱いの説明、同意版とDB整合 |
| Community Guidelines | READY for existing behavior / HUMAN REVIEW REQUIRED for release | 禁止事項・公開範囲・通報・異議申立てを実装と照合済み。対応担当は本人Owner、無人24時間対応の約束なし |
| 特商法 | BLOCKER for paid / HUMAN INPUT REQUIRED | 販売事業者、責任者、所在地、電話番号、問合せ、価格/税、追加費用、支払/提供時期、更新/解約/返金。未提供情報を推測しない |
| Subscription disclosure | BLOCKER for paid | 年額総額・更新周期・解約時期・3日grace・credit付与/繰越・最終確認画面を確定 |

商取引表示は[消費者庁の通信販売広告](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php)、最終申込みは[確認画面の公式案内](https://www.caa.go.jp/policies/policy/consumer_transaction/amendment/2021/notice02/)で再確認。特商法不足を無料人間機能の自動的な阻害理由にはしないが、Live BillingはOFFを維持。共同著作権・国外取扱い・免責条項はPROFESSIONAL REVIEW RECOMMENDED。

### 採用後の実装・検証記録
本人は「案を採用して文面と再同意の準備を進める」と明示承認した。Terms/Privacyの版を2026-10-24とし、共同作品/使用済み添付の保持、通常名義匿名化、本文内PIIの個別申立て、監査等の定期的な必要性確認、無料初回のAI/有料契約OFFを実画面へ反映した。再同意ダイアログにも今回の重要差分を表示する。Room参加の既存同意版を無意味に変更しない。

新migration059は同意記録RPCと現在版guardだけを更新。本人がチェックを付け送信するまで既存同意を更新しない。staging適用済み、production未適用。旧版/成人未確認/権限外拒否、明示同意の保存、全profile同意不変の移行確認を含め9 checks PASS。既存backupの隔離cloneへ042〜059を適用し106 checks PASS。UIとDBを合わせて切替え、旧Previewで新同意が保存できないことを不明な障害として扱わない。

Terms/Privacy/Guidelinesは無料人間機能の方針として採用済み。共同著作権・国外取扱い・免責はPROFESSIONAL REVIEW RECOMMENDEDを維持する。定期的な保持確認の担当は本人Owner、期間を一律約束する自動削除処理は追加していない。具体的な運用日程と個別判断記録は運営手順に残す。採用は法的適合性の保証を意味しない。

特商法の未提示事業者情報はHUMAN INPUT REQUIRED。Subscription disclosureとともにpaid BLOCKERを維持。無料公開では契約申込み/Stripeを無効化し、AIも生成不可。今回production規約・設定・DBは変更していない。


## 2026-10-24 07:21 JST 最終公開モードとの対応
無料人間機能のTerms/Privacy/Guidelinesは本人採用・表示/再同意検証済みでREADY。今回の実機完了を受けMode B（AI/有料OFF）は条件付きGO。特商法・subscription disclosureはHUMAN INPUT REQUIRED/paid BLOCKER、価格・creditはPROVISIONAL。専門家確認推奨と法的適合性の保証を区別する。本番文面/DBは未反映。
