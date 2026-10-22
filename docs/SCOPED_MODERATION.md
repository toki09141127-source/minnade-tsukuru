# 退会中の限定管理経路（2026-10-21）

## 実装
010_scoped_moderation.sqlはローカル候補。003/004/009適用済みの隔離stagingで先に検証する。本番適用・運営担当者の登録は行っていない。
既存API /api/moderation が呼ぶmvp_moderateを置換する。APIはgetUserで認証したIDを渡す既存方式を維持し、bodyの運営IDを信用しない。UI/TypeScriptの変更なし。

- 実行権限はservice_roleのみ。運営担当表を行ロックして在籍確認。JWT actorがある場合は引数actorとの一致も要求。
- 退会申請と同じactor advisory lockで運営担当者の退会状態を確認。申請済みの運営担当者は不可。
- 対象はposts/roomsの存在する非削除行1件。変更できるのはis_hiddenのみ。reasonは既存5種。
- 対象行をロックし、変更前全行とis_hiddenだけ変更した期待行を記録する一回限りの許可を作成。
- 許可はbackend pid/transaction id/表/id/変更前後全行と一致したTriggerだけが消費できる。
- 許可表はRLS有効、PUBLIC/anon/authenticated/service_role全てアクセス不可。公開setterやセッションフラグは使わない。definer関数ownerとDB管理者は信頼境界。
- BEFORE/AFTER Triggerが別列を書き換えたら拒否/全rollback。許可が消費されなかった場合も拒否。
- 変更成功とmoderation_actions追加は同じtransaction。監査失敗なら変更も戻る。
- request UUID再送は同一内容のみ冪等成功。不一致は拒否。権限確認・退会状態確認は再送でも実施。

## 書込停止を緩めない範囲
通常の投稿/名義/owner変更、INSERT/DELETE、直接service_role UPDATEは従来通り。通報本文変更、アカウントBAN、Storage削除、Auth削除、退会解除は対象外。
既存mvp_moderate経路による手動の非表示・復旧だけを許可。汎用「管理モード」は追加しない。
公開された作品でも非表示/復旧は可能。元々論理削除済みの行は復旧対象にしない。
許可は一回消費され、同じtransaction内の後続SQLにも残らない。内部JSONには本文が含まれるがAPIへ返さず、通常成功で保存行は残らず失敗時rollbackする。

## 検証
scoped-moderation-check.cjs：23件。非運営拒否、serviceによる許可偽造/直接書込拒否、セッションフラグ拒否、退会者投稿/ルームの非表示と復旧、再送/競合、本文保持、監査件数、許可残留なし、authenticated偽装/JWT不一致拒否、AFTER Trigger副作用rollback、監査失敗rollback、退会中運営担当者拒否。
実PostgreSQL互換PGliteの合成DB。既存484件と合わせ507件を全回帰runnerで実行。
新規TS/route/UI変更なしのため型/buildは今回再実行しない。前回型/build成功は継続記録。今回対象lint/diffを確認。

## 本番に進む前の制約
実Trigger本文は未確認。特にpostsのedited_at更新Triggerがis_hidden更新でも動く場合、本候補は安全に失敗する。その場合は実定義を確認して運営変更との整合性を個別設計する。edited_at等を無条件許可しない。
reportsのapply_auto_hideはこの限定経路へ自動移行していない。退会者対象の自動非表示で既存書込停止に当たり、通報INSERT自体がrollbackする可能性がある。隔離stagingで通報受付と副作用を照合し、受付を失わない分離/限定RPC連携を検討する必要がある。
実複数接続で運営権限剥奪/退会申請/対象更新の競合、deadlock再試行、既存RLS・definer権限を検証する。新しいdefiner関数ownerの権限/所有者を確認し、一般ロールへEXECUTEを開放しない。
service_roleでoperator表自体を改変できる既存信頼境界は変えていない。service key漏洩や別の危険なdefiner関数まで防ぐものではない。
イベント所有権・Storage・全退会処理の完成とは別。MVP_MODERATION_ENABLED等の本番設定は変更していない。
