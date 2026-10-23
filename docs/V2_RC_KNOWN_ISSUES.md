# V2 RC known issues / boundaries

## RCで許容する未検収
- V2.2実OpenAI HTTP429。今回再送0、synthetic AIのみ。実AIの品質・価格・利用可能性をPASSとしていない。
- iPhone実機未検収。Androidの旧MVP実績はRC実機検収の代用にしない。RCの6幅自動検査は物理端末・スクリーンリーダー認証ではない。
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
