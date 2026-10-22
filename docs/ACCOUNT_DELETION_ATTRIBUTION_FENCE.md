# 公開名義・制作履歴と退会中書込停止（2026-10-21）

## 実装した範囲
009_deletion_attribution_fence.sqlは未適用のローカル候補。003/007/008と監査済み表を前提にする。
既存jobがある環境への適用はEXISTING_JOBS_REQUIRE_RECONCILIATIONで停止。未処理申請に名義処理と停止が済んだと誤認させない。

mvp_request_deletionは本人UUIDのtransaction advisory lockを取得し、以下を一つのトランザクションにまとめる。
- policy/同意/名義選択を検証、再送は元のjobを返す。再送で名義方針変更は不可。
- keep_name：profileの現在のusernameをAuthに依存しないaccount_departed_authorsへ保存。
- anonymous：profiles/public_profilesの検索用usernameを衝突しにくいretired_UUIDへ、posts/room_members/制作メモの表示名を「退会したメンバー」へ変更。
- 更新後の値を確認。既存Triggerが名義を書き戻したら、プロフィール変更も受付も全てロールバック。
- jobと公開名義記録を作成。jobが存在する全stageで書込停止を維持。
作品本文、投稿、決定履歴、参加履歴、制作メモ本文、イベント、添付は削除しない。
匿名表示の実装であり、本文のPII除去や既存UUIDとの再識別防止、プロフィール連絡先消去ではない。完全匿名化・退会完了とは扱わない。
40文字の内部usernameが実環境のCHECK/同期/外部連携と適合するかstagingで検証する。許容されなければ受付全体が失敗して元の状態を保持する。

## DB書込停止
対象のpublicアプリ表にBEFORE INSERT/UPDATE/DELETE Triggerを追加する候補。
JWT actorとOLD/NEWのUUID actor列を確認し、退会申請と同じadvisory lockを取得。
投稿者の付替え、プロフィール再生成、退出行削除、新規投稿を拒否する。service roleでもTriggerは実行される。
新しいactor列/新しい表は自動保証されない。migrationが実際に設置した表・列一覧をstagingで検査する必要がある。
対応範囲：profiles/public_profiles/posts/room_members/rooms/room_join_requests/events/event_members/decisions/novel_drafts/room_pre_archive_notes。
存在する場合：post_likes/room_likes/reports/attachment_uploads/work_drafts/post_publication_reviews。
以降追加された表は別途対応。Storage/Authの外部API、読み取り、既発行署名URLの失効はこのTriggerで止められない。
READ COMMITTED以外は安全停止。複数actorを含む更新や行ロックとの競合でdeadlockが起きればDBが片方を中止する。実複数接続の安全性/再試行・性能はstaging検証が必要。
退会者が所有・承認した行への他人の更新も保守的に止まる場合がある。運営の非表示やworkerの参照解除も例外ではない。監査された限定管理RPCでの解除経路は未実装であり、募集前の阻害要因。
Auth CASCADEによる削除も停止する可能性がある。現在は意図的にAuth削除workerを有効にしない。

## 公開画面
mvp_departed_author_labelsは最大200actor/回で公開名義のみ返す。job/内部記録の直接読取は不可。
公開作品詳細はMVP_ACCOUNT_ATTRIBUTION_ENABLED=true時に名義を取得し、退会済み名義をプロフィールリンクなしで表示。
取得失敗/不正データなら旧名義にfallbackせず作品表示を停止。200件単位で分割。
まだflag無効。009/既存ビュー/Trigger/プロフィール導線の検収後に、退会受付前に有効化する。
ルーム内の既存表示はcanonical posts/room_membersの名義更新を利用。保持名義へのプロフィールリンク抑止を含め、作品詳細以外の全画面E2Eは未完。

## イベント所有権の推奨案（未実装）
events.created_byはNOT NULL/Auth NO ACTION。イベント削除はdecision/member/novel draftをCASCADEさせるため禁止。
推奨：Authから独立したauthor IDと、現役ユーザーの管理権限を分離する。過去作品の作者表示は独立IDで残し、管理権限は受諾済みの後継者へ移す。
後継者なしの進行中イベントは運営確認まで更新停止。公開済み共同作品は読み取りで保持。架空Authアカウントへの無断移管はしない。
created_by nullable化だけでは管理権限や表示が解決しないため、FK変更はここでは行わない。

## Storageの推奨案（未実装）
台帳上attachedで既存作品が参照するファイルは保持。未使用/失敗uploadだけを、actor・path・参照なし・状態をDBで確定して清掃job化する。
アップロード中/投稿確定との競合を先に排除。Storage API削除→不在確認→job完了の順にする。metadata SQL DELETEやprefix全削除は使わない。
Auth側のowner制約は実ファイルのない隔離stagingで確認し、保持ファイルの安全なowner管理を決める。
匿名選択でもファイル本文/EXIF以外のPIIは別審査。既発行URLの有効期間も考慮する。

## 検証
追加28件：匿名/名義保持、本文履歴保持、再送、actor付替え、JWT actor、更新拒否、既存Trigger異常時rollback、公開label権限/上限、公開lookup失敗時の旧名義非表示。
既存456件と合わせ484件成功（全体480件の後、追加4件を含む当該28件を再実行）。
tsc・対象lint・ダミー設定/通信遮断webpack build・diff check結果をdeletion-attribution-*.txtへ記録。
合成DB・モック。実Trigger本文、実複数接続、認証済みブラウザ、実Storage/Auth削除は未検証。本番変更なし。
