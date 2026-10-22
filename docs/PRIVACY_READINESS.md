# Privacy公開準備

Status: USER APPROVAL REQUIRED。2026-10-21。運営の決定リストであり法的適合性の認定ではない。

## データごとの取扱いを決める

- Authのemail/session：本人認証に限定。公開プロフィールやログに流用しない。Auth側保存地域/削除/障害時窓口を確認。
- profiles：username/bio/SNS等の公開範囲を画面で説明。メールlocal-partからの自動名付けはローカル修正済みだが、既存データの調査・是正は未実施。
- posts/rooms/作品：共同作品の公開範囲、期限公開、退会後保持と名義、第三者の個人情報の削除依頼を整理。
- 添付：private bucket、認可付き短期署名、元filenameを保存しない。EXIF等メタデータ除去は未実装。位置情報を含む画像の扱いを決める。
- 新台帳：owner/room/path/status/時刻/サイズ/MIME/post。post_requestsはactor/key/内容ハッシュ/post、rate counterはactor/action/窓/回数。個人関連情報として最小期間を定める。無期限保持をdefault方針にしない。
- 通報：理由と申告者、対象。一般公開不可、閲覧担当を限定。対象者に申告者情報を自動開示しない。
- アクセス/障害/計測：token/署名URL/本文/email/IP生値を通常イベントに含めない。ログ閲覧者と保持期限を決める。

## provider・AI・第三者

Supabase/Vercelなど実際に使用するサービスと契約/処理地域/再委託/保持/削除/事故通知を確認。海外処理や第三者提供の説明・同意等は専門家へ確認する。AI送信は対象データ、目的、保持期間、学習利用、provider/region、送信停止、同意撤回の範囲を定めるまで無効。

## 公開前チェック

1. データマップと利用目的、保存期間/バックアップ/削除例外、窓口を運営が承認。
2. 退会APIの列/FK/部分成功を修正する設計を別レビュー。名義だけを変えて匿名化完了とはしない。
3. 公開profile projection/RLSと削除済みデータの署名拒否をstagingで検証。
4. 事故時の通知・封じ込め・証拠保全・再発防止の担当を指定。
5. TERMS_READINESS、MODERATION_POLICYとの整合を専門家確認。既存TERMS_PRIVACY_REQUIREMENTS.md/LEGAL_RIGHTS_RISK_REGISTER.mdの公式資料を参照する。
## 退会保持方針の推奨案（2026-10-21）

MVP_RETENTION_MODERATION_RECOMMENDATION.mdに具体案を作成。共同作品は必要な許諾範囲で原則保持、公開profileとAuthを切り離し、名義変更は本人確認、個人情報/権利侵害申請は例外審査。退会30日/通常通報証拠90日/再発防止180日見直しは運用上の仮案で法定期限ではない。既存ユーザーへの遡及適用・無条件の匿名化完了を主張しない。未採用。

## 退会整合性の追加調査（2026-10-21）

ACCOUNT_DELETION_INTEGRITY.md参照。危険な退会APIをローカルで一時停止し、画面/APIとも未受付を明示。323合成・モック検査、型/対象lint成功。退会機能の完成・公開可能を意味しない。保持方針、正式受付、Trigger/Storage監査、永続的な再試行設計が残る。

## 第41節更新
画像はsharp再エンコードでEXIF/XMP/IPTC除去を実装・合成検証済み。動画/PDF/textの本文・metadata全体を無害化したとは主張しない。既存作品のPII、公開名義と退会の保持、通報/監査/操作履歴の正式保持期間は未承認。収集SDK/AI providerは未導入。
