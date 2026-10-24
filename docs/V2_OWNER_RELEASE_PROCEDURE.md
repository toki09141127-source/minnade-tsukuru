# Production Owner preparation

2026-10-24. DESIGNATED; procedure rehearsal PASS. Production role grant NOT RUN.

本人指定済みID: `820ed99a-286e-4f96-95da-a66988139415`。追加の候補列挙・再選択なし。検収用identityは本番へコピーしない。

本番切替時に別承認のDB管理者だけが行う順序:
1. 本番ref、対象UUID、Auth/profileの存在・退会/利用停止なし、055〜057の適用hashを確認する。メールで自動検索して権限を付けない。
2. 管理UIはOFFのまま、短いtransactionとlock timeoutでadmin_usersをロック。対象の既存roleが想定外なら停止する。
3. admin_usersへ対象UUID/role=owner/active=trueを一度だけ登録し、同一transactionでadmin_auditへrequest UUID、actor/target UUID、bootstrap、before/after、operational理由、手順hashを記録する。監査失敗ならCOMMITしない。既存の同一Ownerなら役割・監査を増やさない。公開RPC/Service RoleからbootstrapできるGRANTを加えない。
4. READ BACKで対象Ownerと監査1件を照合後に確定する。DB所有者の接続記録を私的運用記録に残す。旧moderation_operatorsを追加してV2権限を迂回する必要はない。
5. 一般公開前の検収窓だけADMIN_ENABLEDを有効化し、本人ログインでOwner一覧/限定停止/監査、ModeratorのOwner操作拒否、一般利用者403をTEST対象のみで確認する。失敗なら直ちに管理入口をOFFへ戻す。既存のAI/退会/Buffer停止を自動解除しない。
6. 失敗時は管理OFFを維持。監査を消去せず、DB所有者による明示的な取消・再確認手順を別承認で行う。唯一のOwnerが退会する前には後継と運用担当を決定する。

staging rehearsal: owner-bootstrap-rehearsal.cjs。既存合成一般利用者のtransaction内だけで6 checks PASS。対象/監査の重複なし、通常app roleの直接権限なし、監査immutable、全行ROLLBACK済み。identity sequenceの欠番はあり得る。本番SQL実行・Auth変更・権限付与なし。

管理の退会後記録: admin_users/audit等はAuth FKを持たず残る。v25_roleは現在Auth/profile・退会/停止状態を検査するため古いUUIDだけで再認証・権限復活はできない。監査のUUID保持を完全匿名化とは呼ばない。最後のOwnerの交代は運用上必須で、本人不在時の復旧担当はHUMAN INPUT REQUIRED。
