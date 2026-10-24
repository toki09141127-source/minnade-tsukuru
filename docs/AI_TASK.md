# AI_TASK

## Status
in_progress

## Objective
承認済み無料V2を固定sourceから本番へ移行。AI・Live Billing OFFを維持し、公開条件が満たされない場合は一般公開を止める。

## Current authorization
2026-10-24 最新f42d38a4: V2 FREE LAUNCHのcommit/push/main統合・本番migration/deploy・TEST限定smoke/退会・24h監視を明示承認。実機最終signup/resetと実AI未検収はKnown Riskとして受容し停止理由にしない。重大なschema/data/security/Auth障害だけ停止。AI/Live OFF維持。

## Tasks
1. 検収済み213ファイルをhash固定（完了）
2. 本番登録メールの復帰FAILを原因調査・修正/再検収（通常loginはPASS）
3. 停止・定期実行pause・直前backup/隔離restore
4. canonical042〜059を順番に適用、既存データ/RLS照合
5. 指定UUIDへ監査付きOwner bootstrap
6. AI/Live OFFの本番配信・限定smoke（実機の最終メール検収は最新承認によりKnown Riskとして受容）
7. 条件成立後だけ一般受付再開、元の運営停止を保持

## Do not
AI/Live Billing ON、force push、既存差分破棄、秘密値/本文/IP/raw log出力。失敗や不明状態をPASSにしない。

## Validation
既存PASSを再利用。移行停止ガード付き18件/106項目と時限Auth窓11項目が隔離コピーでPASS。新しい本番バックアップは停止後に取得する。

## Expected output
本番適用/未適用、Owner/認証/公開状態、保全/復旧、未確認部分をHANDOFFへ記録。

## Updated at
2026-10-24T13:56:12.693Z

## Current result
Production GO / general writes OPEN。migration042-059、production deploy、Owner、メール本文、smoke/security/RLS/退会/TEST cleanup PASS。AI/Live OFF・既存Buffer停止維持。実機signup/resetは受容Known Risk。mainへff-only統合・push完了、正式tag v2.0.0で確定。毎時監視v2-24 ACTIVE（10/25 22:45 JSTまで）。

## Historical progress（以下の結果待ちは当時の記録）
最新: b7zdudurbの再設定確認画面を本人承認後にstaging限定適用。Cookie/共有置換/2callback/限定Reset template保存済み。Hosted4ケース・3幅・axe0/実Auth通信0 PASS、Cookie削除/browser終了。実メール描画とiPhoneの新password→旧拒否→新login/reloadは本人結果待ち、NO-GO維持。i8 AUTH-01のverify303→403を観測したが先読み起因は未確定。詳細はHANDOFF最新節。
AI参照blocker fix eafb75eをRCへcommitし、修正版staging Preview gt5g3hmxp READY/関連6checks/秘密検査PASS。実AI累計8回の限定検収終了、各1原価sample。Draftは残credit制限を維持し出力契約のみ確認。
両実機の依頼済み操作はすべて本人報告PASS: ナビ・投稿画像・Core・Highlight・Draft・AI停止表示・訂正後の作品/log・logout/login・test Checkout画面/return・退会説明。物理端末の決済確定/退会完遂/email returnは未確認。実機用旧共有リンクをOnly people with accessへ戻して共有停止済み。新Preview Cookie削除済み。
3134adb2更新: 本人承認後に本番Free/Admin境界とUI OFFでも動く退会billing前処理をローカル修正、52境界checksと関連11群PASS。Owner/Free退会staging transaction各6 checks PASS・全行rollback。無料規約案採用、Terms/Privacy 2026-10-24、再同意059をstagingだけ適用（自動同意なし）、9 checks PASS。既存backup再利用の042〜059隔離rehearsal106 checks PASS、平文/server cleanup済み。
最新Preview jrvv8pum3 READY（eafb75e + 未commit source digestを記録）。local明示再同意9/5幅axe0、Hosted文面・同意保持5、人間操作・AI停止6 PASS。配信26素材/ローカル1171対象の秘密一致0。本人の最新host限定Cookie/Share/2callback追加承認を受領し実施。Hobby既存共有リンクの置換も別途本人承認済み。人間用共有は実機検収待ちのため有効、secret tokenを記録しない。
本番NO-GO維持: iPhoneは同じSafariの別タブでresetメール2回とも「認証リンクを確認できない」と本人報告。Androidメール復帰/両実機決済/Android退会はPASSを維持。メール2通のstaging project・最新host・reset戻り先は正しい。READ ONLYで2 flowともコード発行を確認したが、callback失敗原因は未確定。旧hostでの追加再送は停止。認証条件を変更せず固定確認コードを表示する診断修正、UI26/型/lint/build PASS、実SDK+合成Authの別タブ正常・情報欠落/不一致/期限切れ4ケースPASS。i8kvltx12へstaging Previewのみ配置、最新状態はdeployment JSON。新host限定Cookie/Share/2callbackは本人承認後に実施済み。Hosted診断表示3ケース/3幅PASS、Auth送信0・console/hydration/5xx0、Cookie削除/browser終了済み。共有と2callbackはiPhoneの固定確認コード取得待ちで保持。今回commit/push/main merge/production/live/OpenAI呼出しNONE。
両実機Plus月払いの決済→return→Plus/500credit→reloadは本人報告PASS。Stripe connectorで各test契約1件・active/月780円・DB ID一致、DBで各現期間1行500付与・消費/予約0・pending event0を確認。通知6件中2成功/4retryable、正確な失敗原因は未確定、全通知成功とはしない。再決済/手動event replayなし。決済用転送停止/Cookie削除済み。証跡v2-final-device-payment-result.json。
Android実機退会PASS: 本人が完了表示・再読込後の編集不可・旧password login拒否を報告。06:15 JSTにjob completedを観測し検収窓を自動終了。READ ONLY照合でAuth/profile/public profile/AI profile各0、billing canceled/deletion confirmed/owner NULL、Auth admin取得404 user_not_found。Stripe testも対象1契約canceled。元の全flagsを復元（AI/intake/worker OFF）、他26job不変・active lease0、転送停止・合成Owner session終了・Cookie/lock削除済み。作品/投稿/添付0の対象なので内容保持は既存RC E2Eの別証拠。v2-final-device-retirement-result.json参照。iPhoneもtest契約を解約し署名通知1/1・DB canceledを確認、最終転送/Cookie削除済み。旧jrvv8pum3 Share停止。iPhoneアカウント/通常sessionと旧2callbackはメール診断用に残し、検収完了とはしない。
