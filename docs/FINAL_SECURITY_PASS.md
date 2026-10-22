# 公開前最終ローカル再レビュー（第41節）
対象: 未コミット差分、ローカルmigration001〜017、全44 route。実利用者データ/本番DBへのアクセスなし。

## 今回修正
- P1候補（コード経路確認、実攻撃未実施）: 通報対象の閲覧資格を検査せずService Role経由で旧自動非表示Triggerへ到達可能。旧APIにcanonical投稿/親room/active参加確認を追加。新017は対象認可・公開ログ審査と同一actor/対象の重複制限をDBで一体化。受領済み同一requestの再送は後の非表示でも可。internal関数はservice_roleにも直接EXECUTE不可。
- P2: いいねのread→toggle競合・応答喪失。014とUI/APIで期待値/希望値/操作IDへ。新機能flag無効時の旧toggleは残り、公開前に014とflagを一緒に検収する。
- P2: ルーム作成とCreator参加の部分成功。015とUI/APIで同一transaction・操作ID再送、任意created_by等の追加入力拒否。
- P2: 単独moderation画面の二重送信・認証切替・再送ID更新。同期ref/世代/再送保持を追加。
- P2: account/moderationに共有DB連打制限がなかった。016と各APIを接続。MVP_DB_GUARDS_ENABLED無効時には効かないためflagの単独有効化を不可とする。
- P2: 未使用添付cleanup未実装。013とworkerをローカル準備。使用済み/退会中owner/成否不明uploadは対象外。
- P3: 作成画面の名前のない入力7箇所、Core最大5という説明を修正。招待コードをcrypto乱数へ。
旧API11経路の410、最小公開列、EXIF除去、本文編集固定と既存の退会書込停止を維持。

## 残るP1（0ではない）
- 本番の無条件SELECT、過剰DML/列権限、旧RPC/Storage設定の修正候補は未適用。ローカル合成fixtureで通っても現行本番が安全になったことにはならない。
- 退会のAuth FK/CASCADE、イベント所有権、公開履歴保持とStorage実挙動。ACCOUNT_DELETION_COMPLETION_GATE.md参照。needs_review停止を外さない。
- 既存公開作品/ログのPIIとlegacy公開範囲。既存作品の無差別非公開化/自動backfillは実施していない。
- 旧参加RPC本文と実Trigger・Storage Policyの互換性、Member45枠競合/同意転記、Core申請pending重複は未完。将来仕様との差はWEB_MVP_FUTURE_SPEC.md。
今回のコード修正を本番のP1解消と表現しない。100%・募集開始可とは判定しない。

## Service Role・直接client
final-route-inventory.json: 44 route、直接privileged参照30、無作用410の静的分類11。final-supabase-clients.json: 70参照ファイル。文字列検出は認可証明の代替ではない。
- 投稿/添付: 本人getUser、canonical room/member/postをserver再取得。新規pathはupload ID台帳で照合、公開署名は意図的未認証でvisible post + published visible room + path + flag時審査を確認。
- room作成/参加/core/管理: 検証済actorを使う。creator等の最終認可はRPC/Triggerに依存。旧join/core410は復活させない。
- moderation/通報: operatorをDBで確認、退会/認証不一致拒否。reporter IDを一覧から除外。本文/秘密のエラーを返さない。
- account: Auth adminは専用worker interfaceに分離、実worker未接続。
- cron: Bearer secretのみ、期限/hidden/deleted/既公開を確認。SQLのSKIP LOCKEDと繰返し0件を実Postgresで検証。
- profile/既読/未読: 本人UID固定、公開projectionあり。プロフィール複数表同期、未読の取得上限/大規模性能は継続課題。
RLSが現行のままで全clientをauthenticatedへ置き換えることはしない。Service Roleは一般ブラウザへ渡さない。

## 検証範囲
ローカルPGlite/SDK・fetchモック、実PostgreSQL17.10の新規合成DBで複数接続を使用。外部Supabase/Storage/Authなし。
ネイティブ検証ツールはアプリpackage.json/lockに追加せず、作業領域.local-pg-verificationへ隔離。npm embedded-postgres@17.10.0-beta.17/pg@8.16.3、install scripts無効。Windowsバイナリを直接使用し127.0.0.1限定、新規temp cluster、終了時pg_ctl停止。
ツール根拠: https://github.com/leinelissen/embedded-postgres （Windows対応とバージョン）。
ログイン空欄エラーとルーム作成初期画面をダミー設定のローカルブラウザで確認。実ログイン/メール/Storage、320px/実機/reader、100人のアプリ全体負荷は未検証。
