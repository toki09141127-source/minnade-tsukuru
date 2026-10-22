# 未使用添付の安全な清掃候補
013とlib/uploadCleanup.tsは未接続・未適用。cronへの配線、実Storage操作、フラグ有効化なし。

## 対象と状態
対象はuploaded_atあり・期限超過・used_at/post_idなし・uploaded状態の台帳行だけ。
FOR UPDATE SKIP LOCKEDで1行claimし、cleanup_pendingへ隔離して5分leaseを発行。
投稿確定はuploadedのみ許可するため、claim後のbind不可。旧pathから所有者を推定しない。
workerは固定bucket、台帳room ID、upload ID、サーバー生成のfolder/extension一致を確認し、Storage APIで1objectをremoveしてからDBへ完了記録する。
DB記録失敗/通信不明はretry、別workerの古いleaseでは完了不可。削除済みtombstoneを保持する。
Storageの成功応答による存在しないobjectのremove挙動は実stagingで検収する。任意の404やerrorを成功と解釈しない。

## 除外するもの
bound/used_atあり、post_idあり、退会中owner、room不明、reserved/failedで成否不明、legacy path、不正path。
特にreserved/failedを期限だけで消すと、遅れて成功するuploadと競合し得るため自動清掃しない。
退会中ownerは009停止を緩めず、レビューされた退会工程で処理する。
13以降のworkerを動かすには001/003/009、既存Storage Policy/Trigger、保持期間（現候補24時間）の検収が必要。
退会のAuth削除条件は別。添付の所有権台帳、二重使用拒否、投稿原子性、既存readは維持。

## 検証
15件のPGlite/Storageモック検査。lease再claim、古いworker拒否、外部成功後DB失敗、再試行、path偽装拒否、使用済み/成否不明/退会中owner保持、一般role拒否。
本物のStorage削除は未実施。
