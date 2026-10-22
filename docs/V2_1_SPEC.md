# V2.1 共同創作の核

## 分離と互換性
- develop/v2 / C:/dev/minnade/minnade-tsukuru-v2。基点 a325926。production変更 NONE。
- V2_ENABLED=true かつ staging fwqucffxdmbdczspkcyr とURL完全一致のときだけ新UI/APIを有効化。
- rooms.v2_enabled=false の既存MVPは旧画面・既存定員/申請処理を維持。内部supporterはV2境界でMemberと表記。
- migration001〜028は不変。Buffer039の次の040〜043を追加。Bufferコードは取り込まない。

## 権限と参加
Creator1人、Core最大4人、Member。定員は全active人間の合計2〜50。作成時にタイトル1〜120文字、説明20〜300文字、6ジャンル、締切1時間以上先〜14日、定員、既存AI利用方針を検証。定員・締切・AI方針・V2種別・ジャンルは作成後変更不可。
Creator/Coreのみハイライト・公開除外・公開内容確認・ドラフト編集。参加者管理はCreatorのみ。Creatorは退出/譲渡不可、Coreは辞退申請→Creator承認でMember→退出。承認待ちのCore権限は保持。
MemberだけがCore申請可能。pending1件、拒否のみ3回まで。満員ではpendingを保持し回数を消費しない。公開時にpending申請/辞退を閉じる。043では退会中の申請も、worker内の既存private.patch_rowによる完全一致の単行capabilityで状態/処理日時だけを閉じる。通常ユーザー・Service Roleの一般UPDATEには退会fenceが引き続き適用される。
joinとCreator作成は明示同意版2026-10-22-v2.1と日時を保存。退出とroom_exclusionsによる追放を区別。追放者は再参加不可。どちらも過去の投稿は保持。

## DBとAPI
新RPCはauth.uid()からactorを決定し、authenticatedだけに変更権限を付与。通常クライアントのRLSを利用し、Service Roleの任意actor呼出を許可しない。新テーブルの直接DMLは許可しない。既存の投稿/Storage APIは既存の認証・台帳・所有権検証を継続。
actor/account fence→room row→membership/post/draftのロックと一意制約、version/CASを利用。既存投稿RPCとの異なるロック順ではdeadlockが起き得るが、transaction全体を中止し再試行可能。部分成功や権限残留を許容しない。
V2操作はアカウント毎60/分、参加10/分、Core管理10/分、作成3/時。既存投稿/画像の制限も継続。失敗時にレート更新を巻き戻すため、これだけでネットワークDoS対策を保証しない。
退会中の書込停止を維持。新しいcore_resignationsのuser_id/decided_by、posts.excluded_byを既存の完全一致・一回限りの匿名化capabilityへ追加。監査済みroom_join_requestsのupdated_at=now()を完全一致の予測値へ含める。一般ユーザーに退会capabilityは付与しない。
V2の添付予約/完了登録とStorage object INSERTに参加・締切を再検査するガードを追加。退出/追放と遅延uploadの競合でも投稿への結合を拒否。既存MVPの登録条件は変更しない。

## 制作ログと公開安全性
1ページ30件、最大RPC50件、日時+IDのcursorで昇順。本文と投稿者名をサーバー検索。すべて/ハイライト/画像あり/自分の投稿。関連イベントは個人名を含めない直近30件。
公開除外は削除と別のflag/by/at。非公開room内では参加者が閲覧可能。公開時は非表示/削除/除外/PII検知/未レビュー/レビューhash変更をDB RLS側で除外する。追放だけを理由に既存投稿を除外しない。
画像は同じroomのbound台帳・post参照・公開レビューを検証。HTMLを保存しない。PII検出は完全な判定ではないため、人間の権利/個人情報確認を必須にする。公開後の運営hideと添付署名拒否を優先する。

## ドラフト・作品
共通JSON block配列でid/type/種類別fieldsを保存し、配列順をorderとする。heading/summary/text/image/list/divider/link。種類に無関係なfieldを拒否。最大50block、全体300KB、本文20,000文字、list100項目。リンクはhttpsの公開パスのみでquery/fragment/認証情報を拒否。
ジャンルテンプレートは指定された見出しと編集用の空欄から開始。未選択画像を無効な参照として自動挿入せず、候補一覧で選んで追加する。空本文は未完成として保持できる。保存時のreviewとversionが必要。409時に入力を残し、最新版との比較・明示的な置換を提供する。
締切後に既存publish workerがV2 snapshotを作る。各block/imageを再検証し、危険になった参照を除外。人間が入力した非空本文/画像/link/listがなければ「未完成作品」。AI補完なし。タイトル・説明・genre・blocks・source_version・公開日時・安全なhighlight IDを固定。
公開snapshotは一般ユーザーとService Roleの直接変更不可。通常画面はsnapshotを読み、制作中draftを公開しない。公開作品→「この作品ができるまで」→安全な公開制作ログへ遷移。既読/いいね/通報は既存経路を利用する。

## 移行と戻し方
040→041→042→043を各transactionでstagingに適用。既存行のv2_enabledはfalse、旧作品やユーザー本文を書き換えない。既存関数置換は新旧roomの分岐と互換テストを必要とする。
UI/APIの運用停止はV2_ENABLED=falseで新規導線を停止し、V2既存データ・snapshotを保持する。このflagは直接RPC/既存publish workerまで一括停止するDBスイッチではない。全経路停止が必要なら既存の保守手順とworker停止を別途計画する。データを削除するdown migrationは用意しない。stagingで既存関数まで戻す場合は新V2書込を停止して、001〜028の監査済み定義と追加列依存をレビューした新しいmigrationを作成する。production適用は今回対象外。

## 検収の限界
モバイル320/375/390はデスクトップChromeのviewport検査。実Android/iPhoneのV2操作は別途必要。既存MVPの過去の実機PASSをV2の実機PASSへ流用しない。staging検収結果はV2_1_ACCEPTANCE.mdと各JSONに記録し、未実施項目をPASSにしない。

## staging検収の実行方法と後片付け
本番向けVercel配信は行わず、最新のproduction buildを127.0.0.1へ起動し、実stagingだけへ接続した。Auth12合成アカウント、合成16px PNG、専用TESTルームを使用。staging/safety.cjsの環境識別とweb-network.cjsの通信先制限を必須とする。秘密値・token・fixture passwordはGit外の.staging-privateに保存する。

scripts/v2/local.cjsは監査済みschemaを隔離native PostgreSQLに再現し、001〜028と040〜043を適用する。MVP_TEST_RUNTIMEにpg/Windows PostgreSQL runtimeが必要。unit.cjsは26項目のdomain/flag検証。staging.cjsは合成Authと制作UI/API、publication.cjsは限定公開、final-ui.cjsは最終ビルドの画像bytes/検索/作成/削除確認の補完検査。いずれも通常の本番cronや本番環境で実行しない。

stagingの締切検収だけは、専用2fixtureのID・Creator・TEST title・V2/openを照合し、ACCESS EXCLUSIVE中にimmutable triggerを一時無効化して期限を調整、同transaction内で即復旧した。認証・退会・RLS・Storage guardは継続。別transactionが全非対象roomをFOR UPDATEし、advisory sentinel保有を必須にする一時helperで2workerを実行した。処理2件/0件、snapshot2件（各room1件）。終了後helper DROP、guard ROLLBACK、immutable有効、旧MVPの公開待ち7件不変をREAD ONLYで確認済み。合成fixtureを消すdown migrationや本番にこのhelperを持ち込まない。
