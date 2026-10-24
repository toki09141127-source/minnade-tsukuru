# V2 RC production rollout proposal

**Production Changes NONE。以下は未実行の提案。V2→main、production migration/deploy、live billingを許可する文書ではない。**

## 正規の順序
1. RC DoD、latest mainとの差分、canonical map、全適用hash、最新staging証跡をレビュー。branch/tagをsourceに固定する。
2. 本番移行の対象・停止時間・担当・復旧判断・ユーザー告知を明示承認する。
3. 全入口をmaintenanceにし、直接Supabase/Auth/Storageと旧deploymentの書込も考慮。publish/AI/deletion/Buffer cronを停止し、in-flight/unknownを処理する。元の停止状態を記録する。
4. 最新backupを取得し、隔離restoreを成功させる。Storage/Auth/Stripe/Bufferを含めて復旧点を照合する。
5. 本番適用済み001〜035/037〜039は再実行しない。036はpg_net ACL試行の歴史的失敗であり適用候補に入れない。040 manual testは本番で必要か個別判断。041のstaging認証経路も本番宛てに余分な資格情報を送らないことを確認。番号だけで一括db pushをしない。
6. V2 canonical042〜057、追加058、再同意059を依存順で適用。各transaction後にschema/ACL/RLS、旧MVP互換・データ保全を確認。059と文面2026-10-24はmaintenance中に一緒に切り替え、旧版しか送れないappへ一般受付を戻さない。失敗/成否不明なら停止し、同じ番号を盲目的に再実行しない。
7. 本番用に別レビューした互換appを配信し、TESTのみで検収。一般書込、共同制作、公開、運営、AI、billing、退会を個別ゲートで戻す。
8. 24時間監視の範囲・欠測・通知先を明示し、段階的に利用者を増やす。Bufferは元の運営意図に従う。

## 現在のRCと本番の差
- 具体的承認後のローカル修正は正確な本番project + VERCEL_ENV=production + V2_RELEASE_MODE=free + V2_SCHEMA_VERSION=58 + V2_ENABLEDを全て要求し、管理はADMIN_ENABLEDも要求。52境界checks PASS。schema58はfoundation設定であり059の実適用を証明しない。productionへの適用/配信は未承認。
- billingはStripe test専用・productionで拒否。live key/価格/恒久Webhook/課金・税・返金・商取引表示・監視は未承認。Free共同制作の公開とlive billing公開を分けて判断できる。
- 合成AIは明示opt-inのstaging Preview限定。productionで合成AIへfallbackしない。実OpenAIは本人確認後の限定8回を実施し、通常参照の不整合を修正。手動Draft E2E・最大費用の判断が残る。
- Admin Ownerの初期指定は合成担当を流用しない。運営者本人を確認し、bootstrapを監査する。Moderatorは限定権限を維持。
- 退会のpauseと新規受付は別。billing stop、公開名義・制作履歴保持、外部effectの完了が揃うまでAuth削除を進めない。

## 適用方法・監査
旧stagingは旧V2番号040〜055で適用されたまま維持。canonical042〜057を適用済みと偽装しない。058と059は別incremental manifestへ記録する。059は既存profileの同意を更新しない。
migration選択はfile名+hash+依存のreview済みリストで行う。SQLをカテゴリ別に並べ替えない。transactionとDDL/ACLの組を維持する。
再構築には監査済みbaselineの非公開artifactが必要。アクセス権とhashを確認した担当だけが利用する。raw定義を公開docsへ転載しない。

## 監視と停止判断
HTTP/Auth、5xx/429、AI失敗/lease/credit、billing pending/quarantined/署名拒否、通報滞留、退会effect、RLS変化、Buffer unknown/cancel/receiptを件数だけで記録する。
Supabase管理Auth/SMTPログは別確認。未収集を正常とみなさない。RLS漏えい・自己昇格・二重課金・他room AI・退会整合性・本番取り違えは即停止。

## 2026-10-24 最終検収での追加ゲート（未実行）
最新はFREE V2 CONDITIONAL GO。切替条件を満たすまでは一般公開不可。実backup/rehearsalの範囲はV2_PRODUCTION_FINAL_ACCEPTANCE.md参照。

### アプリを先に準備する条件
production allowlistとFree billing/退会前処理は本人承認後に一体で修正・検証済み。UI V2 OFFでも導入済みschema上の退会整合性処理を継続し、旧MVPのmissing RPCだけ許容する。052のAuth削除fenceを維持。旧app rollback後もV2 accountと新しい同意版が残るため、退会worker/新規書込を停止・整合確認してから互換appへroll-forwardする。059を旧版同意へ自動で戻さない。

### migrationのリスク分類
042〜058では既存table/columnのDROPやenum変更を検出していない。043はpostsの退会write triggerを置換するため同一transaction内のguard再作成を維持。043のDELETEは既存の許可対象行削除関数内、051/052はAI profile削除関数内、055は運営role削除関数内であり、migration実行だけで全ユーザーデータを削除する文ではない。FK/新CHECK/trigger/function置換は実行時経路への影響を持つ。実cloneの既存78表元column hashは各段階で不変だったが、旧app/newappの途中状態HTTP検収は追加必須。Storage mass deleteを伴う移行は計画しない。

### 段階と検証
042〜045: human membership/log/draft/publication、046〜049: AI（OFF）、050〜054: Free entitlement/credit/退会（Live OFF）、055〜057: Admin（Owner付与前OFF）、058: Buffer/capacity、059: Terms/Privacy 2026-10-24明示再同意。依存順と各file transactionを維持。実backup cloneで18件/106 checks PASS、既存78表元column fingerprint不変。各段階でRLS/GRANT/旧RPC、既存row integrity、対応HTTP smokeを確認し、失敗時は停止してforward-fix。番号だけのdb pushやhistorical036/040/041の再適用禁止。

### 本番smoke（今回は実行しない）
Auth login/logout/recovery、Room作成/consent join、Post/Upload、Core/Highlight、Draft/forced publishの重複防止、Work/log可視性、AI OFFの人間操作継続、Billing OFFで購入不可、Admin Owner/Moderator/一般拒否、Free退会の外部effect→Auth最後、Bufferの既存停止/送信制限をTEST対象だけで確認する。

### 即停止条件
RLS leak、data loss、Auth failure、退会整合性の破壊、誤課金、管理権限逸脱、他room AI漏えい、重複作品、Storage大量削除。本番切替/操作を停止し範囲を保全。旧権限を広く戻すSQLや無条件SELECTは復活させない。Auth/SMTP管理ログは未確認を正常扱いしない。

### 推奨初期状態
技術/実機/無料法務/Owner条件を解消した後の候補: V2人間機能ON、AI OFF、Live Billing OFF。現RCのproduction Pricingは準備中表示で購入経路を閉じる。Adminは本人Ownerの監査付きbootstrapと権限検収後にON。元から停止中の機能を自動で再開しない。Live課金/AI ONは別承認・別検収。


## 2026-10-24 07:21 JST Mode B条件付きGO後の追加ゲート
最新判定はFREE V2 CONDITIONAL GO。実行権限は未付与のまま。tested sourceはeafb75e+未commit修正、b7zdudurb source manifest 0418fb2302c49a8cd391010fac3fd59ed5b9b6538b7e27f03a2150f2068635cb。最終sourceをレビュー・固定してから切替。

再設定の確認画面とPKCE維持はiPhoneでPASS。ただし現在のメールtemplate条件はstagingのb7 reset RedirectToだけで、本番へ自動適用されない。本番では正確な公開host/callbackを別レビューし、明示ボタンのメール経路とsignup/recoveryをmaintenance内で検収してから受付を開く。初回signup callback失敗は未再検収なので、省略しない。認証期限・PKCE・本人getUser必須条件を弱めない。

Owner指定/本番bootstrap、最新保全、migration042〜059、段階HTTP/RLS/退会/停止操作の確認、Auth/SMTP監視・復旧担当を具体的な実施承認に含める。Free/AI OFF/Live OFFを維持。条件不成立ならNO-GOへ戻す。
