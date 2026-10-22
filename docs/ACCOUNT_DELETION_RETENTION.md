# 退会制作履歴の退避実装と追加監査（2026-10-21）

## 実DB監査
ユーザーがsupabase-account-deletion-followup.sqlの読み取り専用実行を承認。対象project joedeuyrzimqyjapqpyh。
ファイル内容を変更せず実行。READ ONLY、15s statement timeout、2s lock timeout、最後ROLLBACK。
SQL Editorが最後のSELECTのみ表示するため、承認済み列SELECTを同じREAD ONLY/ROLLBACKで個別再実行。
5表33列、参照元FK3件を取得。deletion-followup-metadata.jsonが証跡。ユーザーデータ・関数本文・秘密値の取得なし。

- events.created_byはuuid NOT NULL。単にNULL化してAuth FKを解消できない。
- novel_drafts.updated_byはuuid nullable。
- decisions.decided_by、event_members.user_id、room_pre_archive_notes.author_idはNOT NULL。
- decisions/event_members/novel_draftsのevent_idはeventsへのCASCADE。イベントを削除すると共同制作履歴・ドラフトまで失う。
- notes.author_nameと本文noteは別列。名前だけ変えても本文中の個人情報は消えない。
- 新旧監査を合わせ、Auth CASCADE先と所有者NO ACTION先を区別した。データの有無・件数は調べていない。

## ローカル実装
008_deletion_retention.sql：
- account_deletion_retentionを新設する候補。jobへのRESTRICT FK、RLS、一般利用者の権限なし。service_roleもSELECT/INSERTのみ。
- mvp_snapshot_deletion_historyはjobのid/lease/期限/stage=requestedを検証してjob行ロック。
- decisions、event_members、room_pre_archive_notesの本人行だけを、明示した列で1つのJSONスナップショットへ原子的に保存。
- 匿名選択なら退避先author_nameは「退会したメンバー」。keep_nameなら元の名義。元の表・本文・Auth・Storageを変更しない。
- profile連絡先・招待コード・トークン・全列JSONは複製しない。自由記述本文には個人情報が含まれ得るため、退避は公開用データではない。
- 再試行は同一内容のみ成功。差分があればRETENTION_CHANGEDで止まり、最初の退避を上書きしない。
- 戻り値は行数のみ。privateな履歴本文をAPIへ返さない。

lib/accountDeletionRetention.ts：
SDKのprepare契約へ退避RPCを接続。RPC失敗/異常結果は情報を伏せて例外とし再試行可能にする。
成功しても準備完了証明を返さずneeds_reviewへ。verify=null、finalize=falseを明示する。
createAccountDeletionPortsへ注入できるが、自動worker/APIへは未接続。既定の停止を解除していない。

## 安全上の限界
復旧用コピーは共同作品を公開画面に保持する実装の代替ではない。
書込停止が未実装なので、このスナップショットだけでは取得後の更新・追加を防げない。今回はAuth削除へ進ませないことが必須。
jobからactorに辿れるため匿名選択でも完全匿名データではない。本文のPII除去も行わない。運営限定・保持期間・復旧/削除手順が必要。
巨大履歴のサイズ/statement timeout対策と実負荷は未検証。
needs_reviewからの自動復帰は実装しない。監査/方針/コードが整ってから専用の承認付き再開処理が必要。
本番migration未適用。実Auth/Storage処理・本番ユーザー行の読取は行っていない。

## 次に必要な実装と検証
1. events所有者を残す公開authorとAuthを分離する方式、または明示的な所有権引継ぎを決定・実装。架空Authユーザーを作って移す方法やイベント削除は採用しない。
2. nullable参照の更新、投稿名義、制作履歴の公開表示への反映を、既存Trigger本文を安全に確認した後に1トランザクションへまとめる。
3. 全書込経路の退会中認可停止、永続的な準備結果、変化したスナップショットの審査付き再取得を設計。
4. Storageは参照中の添付を保持し、未使用分のみ台帳に基づく清掃。ownerのAuth側制約を隔離stagingで確認。
5. 以上が揃った後のみAuth/Storage workerを有効化し、実SDK失敗/再送/既存トークン/複数接続を検証。

## 検証
deletion-retention-check.cjsの17件：本人3種履歴、匿名/名義保持、他人除外、再送/差分拒否/初回保持、lease拒否、一般role拒否、SDK異常/成功時も削除非許可。
全回帰テストへ登録。PGlite合成fixtureとSDKモックのみ。実際のサービス削除成功を意味しない。
