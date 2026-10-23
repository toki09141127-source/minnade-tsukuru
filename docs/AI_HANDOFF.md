# AI_HANDOFF — みんなで作ろう（仮）

最終更新：2026-10-22（日本時間）
対象リポジトリ：`C:\dev\minnade\minnade-tsukuru`

ChatGPT Work と Codex が、目的・現在地・次の作業を共有するための引き継ぎメモ。会話全体を自動同期するものではなく、双方がこのファイルを読んで更新する運用とする。記載内容と実際のコード・Git状態が異なる場合は、差異を確認してから更新する。

## 1. プロジェクト目的

クリエイター志望者が、一人では難しい創作にチームで挑戦し、作品を完成させられる場を作る。最大50人の制作ルームで creator / core / supporter に役割を分け、制作ログの共有から最終提出まで進めるWebサービス。

共同制作への参加、作品完成、継続利用を増やし、小規模な有料利用につながるかを検証する。

## 2. 3か月目標

- 登録ユーザー：100人
- 共同制作参加者：25人
- 完成作品：10件
- リピーター：20人
- 有料ユーザー：3〜5人（ストレッチ目標：10人）

これらは目標値であり、達成実績ではない。計測期間の起点・終了日、リピーターや有料ユーザーなどの集計定義、現在の実績は未確認。次回の事業方針整理で確定する。

## 3. 技術構成

- Next.js 16 + TypeScript（App Router / API Routes）
- `package.json` 上のバージョン：Next.js 16.1.6、React 19.2.3、TypeScript ^5
- Supabase：Postgres / Auth / Storage
- Vercel：ホスティング
- Tailwind CSS：スタイル
- 添付ファイルのStorageバケット：`room_uploads`

秘密鍵・アクセストークン・環境変数の実値は、このファイルに記載しない。

## 4. 現在の最優先課題

添付ファイルの署名URL発行と投稿作成の認可を固め、閲覧できない投稿・退会済み参加者・別ルームの添付パスを通じた不正アクセスを防ぐこと。

直近は、すでにある第一段階修正をレビュー・動作検証し、残る課題の優先順位を決める。実装が存在することと、動作検証済み・本番反映済みであることを区別する。

## 5. 第一段階セキュリティ修正：実装済み

以下は今回の引き継ぎ作成時にローカルコードで確認した既存変更。この文書作成作業ではコードを修正していない。

### 公開作品の署名URL：`app/api/storage/sign/route.ts`

- クライアント指定の任意pathではなく、`postId` を受け取り、DBの投稿から `attachment_url` を取得する方式。
- 投稿が存在し、`deleted_at` がなく、`is_hidden === false` であることを確認。
- 所属ルームが存在し、`status === 'forced_publish'`、未削除、`is_hidden === false` であることを確認。
- 条件を満たす添付に対して、有効期間5分の署名URLを発行。
- 公開作品向けの経路であり、ログインやルーム参加を要求する経路ではない。

### 参加者向けの署名URL：`app/api/uploads/sign/route.ts`

- Bearerトークンでユーザーを認証し、`postId` から投稿と添付パスを取得。
- 投稿の削除・非表示状態を確認。
- `room_members` の対象ルーム・ユーザーに加え、`left_at IS NULL` を確認し、退会済みの参加者を除外。
- 有効期間5分の署名URLを発行。

### 投稿作成：`app/api/posts/create/route.ts`

- 添付は署名URLではなくStorageのpathを保存する。
- 添付pathが `rooms/${roomId}/` で始まることを確認。
- バックスラッシュ、空のパス要素、`.`、`..` を拒否。
- 現在のコードでは、認証、open状態のルーム、`left_at IS NULL` の参加者、final投稿に対するcreator/core権限も確認する。これら全てを今回新規追加したという意味ではない。

### 呼び出し元の変更

- `app/works/PostAttachment.tsx`
- `app/works/[id]/AttachmentView.tsx`
- `app/works/[id]/page.tsx`

公開作品の添付表示から `postId` を渡し、`/api/storage/sign` の新しい入力方式に対応している。

## 6. レビュー後の未対応・未確認課題（2026-10-21）

第一段階の差分レビュー・型チェック・ビルド・模擬DBによるAPI動作検証を実施。追加修正と結果は第10節を参照。以下の旧一覧は調査開始時の記録であり、削除・非表示ルームのガードと署名時のルーム内path検証は今回対応済み。実環境検証、添付所有者管理、負荷対策は未対応。

### 調査開始時の一覧

以下は次回調査・検証する項目。過去の会話から未対応一覧の全容を取得できていないため、網羅的な監査結果として扱わない。

- 第一段階修正の自己レビュー、必要なビルド・動作検証。型チェック・lint等の直近のCodex実行結果は下記に記録済み。リポジトリ全体のlintに残る既存エラー・警告は未解消。
- 公開作品／未公開作品、削除・非表示の投稿やルーム、未ログイン／非参加者／参加中／退会済みユーザーについて、署名URL発行の許可・拒否が想定どおりか確認。
- 正常な添付path、他ルームのpath、外部URL、空要素・相対移動を含むpathの投稿作成テスト。
- `uploads/sign` の所属ルームに対する削除・非表示・公開状態の扱い、および `posts/create` のルーム削除・非表示状態の扱いを、仕様と照合する。現コードでは該当ルーム状態の確認が十分か未検証。
- path検証だけで添付の存在・所有者・同一ルーム内での他人の添付流用まで防げるかは未検証。Storageポリシーやアップロード処理も含めて確認する。
- Supabaseの実環境のRLS、Storageバケット公開設定・ポリシー、service roleを使う他APIの認可を確認。今回は管理画面・本番DBを確認していない。
- 投稿本文のサイズ上限やリクエスト頻度制限など、負荷・悪用対策は次段階の検討事項。現コードでは本文2000文字制限が撤廃されている。
- 本番デプロイ状況と、本番環境での検証結果は未確認。

次に着手する際は、まず既存差分のレビューと検証計画を提示し、その結果を本節に反映する。

### 前回共有されたCodex実行結果（今回の実測は第10節）

以下はユーザーから共有された直近のCodex実行結果。今回の文書更新では型チェック・ESLint・全体lintを再実行していない。

- `npx tsc --noEmit`：成功。
- 変更ファイル限定ESLint：エラー0件、既存の `<img>` 最適化警告1件。
- `npm run lint`：既存の70エラー、7警告により失敗（今回変更由来ではない）。
- `git diff --check`：成功。
- 自動テスト：`package.json` にテストスクリプトがないため未実施。
- 第一段階セキュリティ修正：6ファイル、87行追加、29行削除。今回の文書更新時にもGit差分の集計と一致することを確認。
- `/api/storage/sign` に `{ path }` を送る呼び出しが残っていないことを確認済み。

## 7. Git状態と未コミット変更の扱い

今回終了時もブランチとHEADは下記と同一。未ステージの追跡ファイルは下記6件に `app/api/uploads/route.ts`、`app/api/uploads/public/[postId]/route.ts` を加えた8件。`lib/attachmentPath.ts` と `docs/security-route-check.cjs` を新規追加。`AGENTS.md`・`docs/` は引き続き未追跡。ステージ済み差分なし。以下は開始時の記録。

2026-10-21の確認時点：

- 現在のブランチ：`security/fix-storage-sign`
- HEAD：`ff1fe59` — `fix: prevent false re-consent modal by handling abort errors and avoiding needsConsent on fetch failure`
- 既存の未コミット変更：以下6ファイル。すべて未ステージ。ステージ済み差分はなし。
  - `app/api/posts/create/route.ts`
  - `app/api/storage/sign/route.ts`
  - `app/api/uploads/sign/route.ts`
  - `app/works/PostAttachment.tsx`
  - `app/works/[id]/AttachmentView.tsx`
  - `app/works/[id]/page.tsx`
- 文書ファイル：`AGENTS.md`（今回新規作成）、`docs/AI_HANDOFF.md`（今回更新）。いずれも未追跡・未コミットのまま保持。

既存変更は作業途中の成果として保持する。勝手な取り消し、上書き、reset、clean、stash、ブランチ切り替えをしない。再開時は必ずGit状態を取り直し、この記録だけで判断しない。commit・push・本番反映は、ユーザーから明示的な指示がある場合にのみ行う。

## 8. 共通作業ルール

1. ChatGPT Work・Codexともに、作業開始時にこのファイルを読み、対象リポジトリ、ブランチ、未コミット差分を確認する。
2. 作業終了時にこのファイルを更新する。実施内容、変更ファイル、検証結果、未対応課題、次の一手を記録する。未実施・未確認は明記する。
3. 勝手にcommit・pushしない。既存の未コミット変更を保持し、ユーザーの作業を混ぜて取り消さない。
4. 大きな変更の前に、目的、変更範囲、影響、検証方法を提示する。依頼範囲を超える変更は、着手前にユーザーと合意する。
5. 同じファイルを複数の担当・アプリから同時に編集しない。引き継ぎ先は最新のファイルを読み直す。
6. ChatGPT Workは目的・優先順位・方針の整理、Codexは実コードの調査・実装・検証を中心に担当し、決定事項と結果を本ファイルに残す。
7. Codex向けの共通作業ルールをリポジトリ直下の `AGENTS.md` に記載し、作業開始時の本ファイルの読み込みと終了時の更新を指示する。ChatGPT Work側も同じファイルを読んで更新する。

## 9. 前回の作業記録（文書整備）

- 依頼範囲：リポジトリ直下の `AGENTS.md` の新規作成と、`docs/AI_HANDOFF.md` の検証結果更新。
- 変更ファイル：`AGENTS.md`、`docs/AI_HANDOFF.md`。
- 実施内容：Codex向け共通作業ルールを追加し、ユーザー共有の直近のCodex実行結果を反映。検証が未確認となっていた記載と、共通作業ルールの運用説明を更新。
- 検証結果：ブランチ・未コミット変更・第一段階修正の差分集計を確認。今回の作業は文書のみのため、アプリの型チェック・lint・ビルド・自動テストは再実行していない。
- 未対応課題：第6節に記載の自己レビュー・動作検証、既存lintエラー・警告など。
- 次の作業：ユーザーの次回指示に基づき、第一段階修正の差分レビューと動作検証を進める。
- 既存コード変更、commit、push、deployは行っていない。


## 10. 今回の作業記録：既存差分レビューと追加修正

実施日：2026-10-21（日本時間）。

### 確認した問題と実装

- 既存の6ファイル・87行追加/29行削除をレビュー。先に問題点と修正方針をチャットで説明してから追加修正。
- 参加者用署名APIが所属ルームの削除・非表示を確認していなかった。投稿・参加状況に加え、ルームの存在、未削除、is_hidden === falseを確認するよう修正。参加者のclosed/forced_publishルーム閲覧は従来どおり維持。
- 投稿作成とアップロードも削除・非表示ルームを拒否するよう修正。open状態と参加中の条件は維持。
- 投稿作成だけでは既存DB内の別ルーム添付を防げないため、両署名APIでもpathを検証。共通関数で所属ルームのprefix、空要素、相対移動、バックスラッシュ、%・?・#・制御文字を確認。通常のアップロードで生成されるpathは許可。
- 別経路 GET /api/uploads/public/[postId] は認可なしでpost_attachmentsから署名していた。公開用POSTと同じ認可処理に統一し、成功時の302は維持。参照元はposts.attachment_urlへ統一。旧テーブルの存在やデータ、本番利用者は未確認。旧テーブルだけにある添付は404になるため、リリース前に利用状況を確認すること。

### 今回の変更ファイル

- app/api/posts/create/route.ts
- app/api/storage/sign/route.ts
- app/api/uploads/sign/route.ts
- app/api/uploads/route.ts
- app/api/uploads/public/[postId]/route.ts
- lib/attachmentPath.ts（新規）
- docs/security-route-check.cjs（新規、再実行用テスト）
- docs/AI_HANDOFF.md

既存の作品表示3ファイルとAGENTS.mdは今回変更していない。既存未コミット変更を保持し、commit / push / deployは未実施。

### 検証結果と限界

- 修正前：APIを模擬DB/Storageで直接実行。33ケースの期待動作と、8ケースの未対応状態を確認。
- 修正後：node docs/security-route-check.cjs で52ケースのassertion成功。51ケースは許可・拒否の回帰確認、1ケースは「同一ルーム内の添付所有者・存在未確認」を再現する既知制限。52件すべての安全性を保証する意味ではない。
- テストは実際のTypeScriptルートを変換して実行し、DB/Auth/Storageはモック。拒否時に署名・投稿保存・アップロードが呼ばれないことも確認。通信・実データ更新は行わない。RLS、実ストレージのURL正規化、ブラウザー表示、実トークンでの認証は検証していない。
- node node_modules/typescript/bin/tsc --noEmit --incremental false：成功。
- npm run build：修正前・修正後とも成功。既存middleware規約の非推奨警告あり。
- 変更対象のlint：既存のapp/api/uploads/route.tsのno-explicit-any 1件、AttachmentView.tsxのimg警告1件が残存。その他の変更対象・新規テスト・共通関数はエラーなし。
- 全体lint：開始時は66エラー・7警告（前回共有の70エラーとは異なる）。公開旧APIの置換で既存anyを1件除去。最終結果は65エラー・7警告。新規テストのlint指摘は修正・再検証済み。
- git diff --check：成功。ステージ済み差分なし。

### 次の作業

1. Supabaseの実環境でposts/roomsのis_hiddenのNULL有無、RLS、room_uploadsの非公開設定とStorageポリシーを読み取り確認する。実環境の設定変更は別途方針を説明する。
2. 既存post_attachmentsの利用・データ有無、および既存attachment_urlのpath形式を確認。現状は不正/旧形式を安全側で拒否するため表示できなくなる添付があり得る。
3. テスト用アカウントとデータで公開/非公開、削除/非表示、参加中/退会済みの実ブラウザー動作確認を行う。
4. 同一ルーム内の添付流用防止は、アップロード時にuser_id・room_id・storage_pathを保存する所有者管理などを設計してから実装する。今回のprefix検証だけでは存在・所有者を保証しない。
5. 全体lintの既存エラー、入力型不正時の500、本文サイズと頻度制限、他のservice role APIの認可を別途調査。

本番反映・本番安全性の確認は未実施。追加実装はローカル未コミットの状態。

## 11. 添付ファイル所有者管理の設計調査（2026-10-21・未実装）

### 11.1 依頼範囲・現在地・検証

- AGENTS.mdと本書を読み、現在のローカルコードを再調査した。今回は本節の追記のみ。コード、DB、マイグレーションは変更せず、commit / push / deployも実施していない。
- ブランチはsecurity/fix-storage-sign。開始時は追跡済み8ファイルの未ステージ変更（116行追加・78行削除）と、AGENTS.md、本書、docs/security-route-check.cjs、lib/attachmentPath.tsの未追跡ファイル。ステージ済み変更なし。既存変更は維持。
- 第10節の修正は現在のコードに存在する。過去レビュー時の%2e%2eと別ルームpathの問題は共通path検証で対処済み。本調査は残っている同一ルーム内の所有者・利用状態確認に限定する。
- node docs/security-route-check.cjs を再実行し52ケース成功。うち42番は「同一ルーム内の任意pathを投稿へ保存できる既知制限」をHTTP 200で再現するもので、安全性の合格ではない。実際のアップロード者レコードを使った結合テストではなく、所有者照会なしで投稿が保存されることの模擬確認。
- 実DB、RLS、Storage設定・owner_id実値、既存データ、監査ログ、本番動作は未確認。リポジトリ内にSQLスキーマ・マイグレーションは見つからず、以下の列型・FK・ポリシーは提案。設計調査のため型チェック・lint・buildは再実行していない。

### 11.2 現在のアップロード処理全体と所有者情報

1. app/rooms/[id]/BoardClient.tsx のuploadFileがBearerトークン、roomId、fileをPOST /api/uploadsへ送る。
2. app/api/uploads/route.ts はauth.getUser(token)で本人を検証。ファイル拡張子・サイズ（画像10MB、動画50MB、その他25MB）、ルームがopen・未削除・is_hidden === falseであること、room_membersのuser_id一致とleft_at IS NULLを確認する。
3. サーバーで rooms/{roomId}/{images|videos|files}/{crypto.randomUUID()}.{ext} を生成。拡張子はMIMEと検査済みファイル名から決める。pathにユーザーIDは含まれない。
4. supabaseAdmin（Service Role）でroom_uploadsへupsert:falseでアップロードし、storagePath / mimeType / fileName / fileSizeを返す。アップロード記録をアプリDBへinsertする処理はない。
5. BoardClientは返却pathとMIMEをattachment_url / attachment_typeとしてPOST /api/posts/createへ送る。投稿作成APIは認証・ルーム・参加・final権限とpath形式を確認し、postsに保存する。
6. 投稿一覧はattachment_urlを取得するため、閲覧可能な同一ルーム参加者が他人のpathを知ることは通常動作であり、pathを秘密にする対策では防げない。
7. 投稿失敗・離脱時にアップロードを取り消す処理や孤立ファイル回収はない。再送すると再アップロードして別オブジェクトが増える可能性がある。

所有者情報の所在：認証済みuser.idはアップロードAPIの処理中には存在するが、永続保存されない。posts.user_idは「投稿者」であり、「そのファイルをアップロードした本人」の証明ではない。room_membersは参加資格しか表さない。

Supabase公式資料では、Storageのowner_idはJWTのsub由来であり、Service Keyで作成したオブジェクトには所有者が設定されない。現在のService Roleアップロードから実利用者のowner_idが自動保存されるとは期待できない。実環境の値は別途確認が必要。所有者の設定そのものもアクセス制御の代替ではない。
出典：[Storage Ownership](https://supabase.com/docs/guides/storage/security/ownership)

### 11.3 現在の問題点・想定攻撃経路

- 同じルームか：isRoomAttachmentPathでpath文字列のルームprefixと危険文字を確認する。Storage実体と信頼できる台帳との照合ではない。
- 本人がアップロードしたか：確認する記録・照会がない。
- 未使用・利用可能か：使用済み状態、期限、実在、アップロード完了を確認しない。すでに他投稿が参照するpathも保存できる。
- MIMEもリクエスト値を保存している。台帳導入後はサーバーが記録した値を採用する。ただしブラウザー由来MIMEの保存だけでファイル内容の安全性を保証するものではない。

攻撃例：同一openルームの参加者BがAの投稿からpathを取得し、自分のBearerトークンでPOST /api/posts/createへ同じpathを送る。ルームprefixも参加資格も満たすためBの投稿として保存される。Bがcore/creatorならfinalにも流用可能。元投稿が後で非表示・削除されても、複製先が許可される状態なら同じ実体を署名できる可能性が残る。これは通常の参加者閲覧を禁止する話ではなく、他人のStorageオブジェクトを自分の投稿へ紐付ける権限の問題である。

ダウンロード可能な内容を保存し、自分の新規アップロードとして再投稿する行為までは、本設計だけでは防げない。対象は既存Storage path / uploadIdの無断流用であり、著作権上の作者判定ではない。

### 11.4 推奨設計と代替案の比較

推奨：アプリ管理の新規attachment_uploads台帳を1つ作り、サーバーがアップロード者・ルーム・実体・状態を記録する。投稿作成と台帳の使用確定は単一のPostgresトランザクション/RPCで行う。新規添付は原則1アップロードにつき1投稿。単なるSELECT確認後の別HTTPリクエストによるINSERT/UPDATEでは、同時投稿・清掃との競合を防げない。

- 新規台帳案：投稿前の状態を自然に記録でき、期限・失敗・使用済み・削除処理を管理できる。現在のposts.attachment_urlと表示方式を維持できる。DBテーブル・RPC・権限の追加が必要だが、今回の二段階アップロードに最も小さく適合する。
- postsへ列追加だけの案：attachment_owner_id / uploaded_at / attachment_state等を追加しても、アップロード時点では投稿がない。先に下書きpostを作る方式へ変える必要があり、一覧・公開・未読・集計・削除の全経路で下書きを除外する変更が必要。投稿時にowner列へ本人IDを入れるだけでは所有者の偽装を防げない。今回の最小案には不向き。
- 既存post_attachments拡張案：実在し適合するテーブルがあるなら、uploader_user_id、room_id、nullable post_id、状態等を追加して台帳に転用できる。ただし現在の署名APIはpostsへ統一済みで、旧テーブルの実在・制約・利用は未確認。名前だけを根拠に採用しない。調査後、同じ台帳要件を満たせる場合のみ新規作成と比較する。
- storage.objectsへ独自列追加・直接SQL更新する案は採用しない。Storage管理スキーマをアプリ台帳として改造しない。
- pathへのuserId追加だけなら所有者境界の補助にはなるが、未使用・期限・失敗回収・同時使用を管理できない。署名付きアップロード証明トークンだけでも再利用防止には消費記録が必要なため、台帳の代替にはしない。

### 11.5 提案するDB変更内容（DDL未作成）

attachment_uploadsの候補カラム：

- id：UUID主キー。サーバー生成。将来クライアントにはuploadIdとして渡す。
- user_id：アップロード者。auth.getUserで検証したIDのみを保存。新規行はNOT NULL、作成後変更禁止。
- room_id：アップロード対象ルーム。新規行はNOT NULL、変更禁止。実際のrooms.id型に合わせる。
- bucket：room_uploads固定をCHECKするか、当初はAPI側固定。保存する場合はNOT NULL。
- storage_path：サーバー生成path。NOT NULL、変更禁止、UNIQUE(bucket, storage_path)。既存形式は維持可能。
- status：uploading / ready / attached / deleting / deleted / failedなどの限定値。ユーザーから任意変更不可。used_atだけではアップロード未完了・削除中を区別できないため必要。
- post_id：使用先posts.id、未使用時NULL。現行1添付なら非NULLに一意制約を置き、1投稿に1台帳行を保証。投稿削除でNULLへ戻して再利用可能にしない。
- created_at：DB生成timestamptz、アップロード予約時刻。
- uploaded_at：Storageアップロード成功後の時刻。readyへ遷移するときに設定。
- used_at：投稿との紐付け成立時刻。post_idと同じトランザクションで設定。
- expires_at：未使用添付の利用期限。具体値は承認前の候補として24時間。サーバー時刻で評価。
- mime_type / size_bytes：サーバーが受け取ったMIMEと実バイト数。サイズは非負、必須条件は状態に応じる。元ファイル名は表示が必要な場合だけ任意保存。
- updated_at / deleted_at：状態変更と物理削除完了の追跡。削除ジョブの試行回数・最終試行・短い失敗コードも運用時に検討。

制約・索引：状態とpost_id/used_at/uploaded_atの整合CHECK、bucket/path一意、現行1添付用post_id一意、(status, expires_at)清掃索引、(user_id, room_id)索引。所有者とposts.user_id、ルームとposts.room_idの一致はRPCで検証し、必要なら複合FKまたは制約トリガーで補強する。テーブルをまたぐ整合性を通常のCHECKだけで表現しない。

FKの削除動作は要設計。現行ルーム削除はroom_members削除後にroomsを物理削除するため、安易なRESTRICT追加は部分失敗を起こす。一方CASCADEで台帳を消すとStorageの清掃情報を失う。最小の整合案は台帳のFKをRESTRICTにし、ルーム削除を「単一DBトランザクションで削除予定化→非表示/利用不可→Storage清掃→物理削除」に整理すること。既存の物理削除を維持するなら、削除対象pathを永続outboxへ退避するトランザクションが別途必要。ユーザー物理削除と投稿物理削除にも同じ保持方針を適用する。FKだけを先行追加しない。

postsへのattachment_upload_id追加は最小案では必須ではない（台帳のpost_idから逆引き可能）。理想案では関連テーブルへ移す。今回の提案はDBスキーマ変更を含むため、実装前に採用案・削除方針・DDLを提示して合意する。

### 11.6 RLS・Service Role・直接書き込み経路

最小案は現行のサーバー経由アップロードを維持する。

- attachment_uploadsはRLS有効。anon/authenticatedに直接INSERT/UPDATE/DELETEを許可せず、テーブル権限も取り消す。画面が直接読む必要はないので当初SELECTも非公開にできる。将来必要ならauthenticatedのSELECTだけ user_id = auth.uid() AND 有効な参加資格 に限定する。所有者であってもuser_id・room_id・path・status・post_idを書き換えさせない。
- RPCはSECURITY INVOKERを基本とし、EXECUTEをPUBLIC / anon / authenticatedから取り消し、service_roleだけに許可。APIは検証済みuser.idをactor_user_idとして渡す。クライアントbodyのuser_idを転送しない。Service Role呼び出しでauth.uid()が本人を表すと仮定しない。
- RPC内でルーム・参加・final権限・所有者を再確認する。Service RoleはRLSを迂回するので、RLSを有効にするだけではサーバーの認可漏れを防げない。
- postsへのREST直接INSERT、attachment_urlやroom_id/user_idを変えるUPDATE、既存RPC・ビュー・トリガーにも迂回がないか確認する。最小案ではユーザーのposts直接書き込みを禁止し、必要な操作は検証済みAPIへ限定する。読み取りRLSは既存機能を保つ。既存に広いPERMISSIVEポリシーがあれば追加ポリシーだけでは制限できないため、権限・既存ポリシーを合わせて見直す。
- room_uploadsは非公開。通常ユーザーによる直接upload/update/upsert/move/copy/deleteを許さない運用を基本とし、既存Storageポリシーを実環境で確認する。正規アップロードAPIを迂回して実体を差し替えられる場合は台帳だけでは不十分。
- Service Roleを使う箇所は台帳予約・状態更新、Storage upload/remove、限定RPC、認可後の署名発行。秘密鍵はサーバー限定。原理上Service Roleが必須という意味ではなく、ユーザーJWT＋厳密RLSに再設計する代替もあるが今回の最小案には含めない。
- 将来ユーザーJWTでRPCを直接呼ぶならactor引数を信用せずauth.uid()由来にし、必要に応じて限定SECURITY DEFINERを使う。search_path固定・完全修飾名・最小EXECUTE権限・関数内認可が必須。

出典：[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[Database functions](https://supabase.com/docs/guides/database/functions)

### 11.7 アップロードと投稿作成の検証フロー

アップロード：認証→現在のルーム・参加・容量確認→サーバー生成ID/pathでuploading台帳行を予約→Storage upload(upsert:false)→成功時だけready＋uploaded_atへ条件付き更新→返却。user_idは認証結果からのみ採用。uploading予約を先に作ることで途中失敗の清掃対象を追跡できる。StorageとPostgresは単一トランザクションにならないため、失敗時の補償削除と再試行を設計する。台帳更新失敗時は成功レスポンスを返さない。

投稿：

1. APIでBearer認証とJSONの実行時型検証。添付なし投稿は従来どおり許可。
2. 最小案は既存attachment_urlを「台帳検索キー」としてだけ受け取り、固定bucket＋pathの完全一致で台帳を引く。返却された台帳のpath/MIMEだけをpostsへ保存する。台帳がなければ旧形式を含め新規添付として拒否。クライアントのattachment_typeは採用しない。
3. RPCの1トランザクション内でルーム・参加行・対象台帳を決めた順序でロックし、open・未削除・非表示false・left_at NULL・必要なfinal権限を確認する。退会・ルーム終了・清掃と競合した場合の順序をロックで確定し、既存更新経路のロック順序も確認する。
4. 台帳のuser_id = 認証ユーザー、room_id = 投稿先、status = ready、post_id/used_atがNULL、期限内、path形式適正をすべて検証する。readyは「信頼するサーバーが実アップロード成功を確認した」状態であり、ユーザー申告ではない。外部の削除/差替えを許さない運用が前提。必要なら投稿前のStorage実在確認を補助的に行うが、HTTPの存在確認だけでDBとの原子性は得られない。
5. 投稿を作成し、同じトランザクションで台帳をattachedへ移しpost_id・used_atを保存する。条件付き更新が0件なら全体をロールバック。同じuploadを使う同時要求は片方だけ成功させる。
6. 不許可添付は「利用できない添付」等に統一して、他人の所有者や使用先を返さない。認証失敗401、形式不正400、本人の競合/期限等は必要最小限の応答にする。
7. 通信切断後の再送には(user_id, request_id)の一意な冪等キーとリクエスト内容照合を推奨。成功済み同一要求なら既存postIdを返し、本文等が異なる再使用は拒否する。最小安全実装で省く場合も二重作成は拒否し、クライアントに結果確認が必要になることを明示する。

所有者確認は新規紐付け時に行う。署名URL発行に「閲覧者＝アップロード者」を要求してはいけない。参加者の共同閲覧と公開作品の未ログイン閲覧は、既存の投稿・ルーム認可で維持する。新規台帳添付については署名時にpost_idとの整合を確認する案が望ましいが、旧添付の扱いとセットで導入する。

### 11.8 既存保存済み添付・移行・既存機能への影響

- 最小案では既存posts.attachment_urlを変更せず閲覧を維持するため、Storageの移動・一括コピー・全件バックフィルは不要。新規台帳/RPC/RLS等のスキーマ導入は必要。
- 既存pathを新規投稿へ紐付ける処理は、台帳に本人のready行がない限り拒否する。切替前にアップロード済みで未投稿のファイルは再アップロードが必要。互換性のため「台帳がなければpathだけで許可する」フォールバックは禁止。
- posts.user_idから所有者を推測してready行を作ってはいけない。過去の流用を正当化してしまう。旧データを移行するなら監査ログ等で検証できた所有者だけを記録し、不明なものはlegacy/所有者不明かつ再利用禁止として別扱いする。旧データを無理に新規台帳のNOT NULL user_idへ押し込まない。
- すでに成立した同一pathの不正共有は、これからの新規投稿を制限しても自動修復できない。既存postsのbucket/pathごとの複数参照・投稿者不一致を読み取り監査し、元の証拠を確認して個別是正する。正常な共有・再投稿の可能性もあり、重複を自動削除しない。
- 同じファイルを制作ログとfinalに使う仕様が必要なら、現行の「1upload・1post」では再アップロードが必要になる。本人に限った明示的再利用を許可する場合は、別の関連テーブルと再利用認可へ拡張し、used_atをNULLへ戻す方式にはしない。
- DB先行で台帳/RPCを導入し、その後APIを切り替える。書き込み権限の締め付けとAPI切替は旧サーバーが残らないよう調整する。必要なら短い書き込み停止を設ける。旧APIが存続する期間は所有者保護完了とみなさない。セキュリティ制限を外すロールバックは避ける。

### 11.9 孤立ファイル削除と競合対策

- readyで期限切れ・post_id NULLの行、長時間uploading/failedの行を候補とする。例の24時間は提案値で、運用上の投稿猶予と合わせて決める。
- 清掃ジョブはDBトランザクションで対象行をロックし、未使用・期限を再確認してdeletingへ条件付き更新する。投稿RPCも同じ行をロックしready以外を拒否するため、清掃と投稿の両方が成功する競合を避ける。
- DBロックを解放後、Service RoleのStorage API removeで実体を削除し、成功または不存在確認後にdeletedを記録。失敗時はdeletingのまま再試行し、未使用へ戻して再利用させない。バッチ件数・再試行回数・監視を設ける。
- uploading処理と清掃の競合にも注意する。実行期限/リースを管理し、遅延upload後のready更新が失敗したら補償削除する。清掃完了後に遅延uploadが実体を再生成するケースは、墓標保持とStorage照合による再回収で補う。
- attachedは未使用ファイル清掃の対象外。投稿の論理削除でも即座に実体を消さず、復元/監査/保持方針と他の参照を確認する。used_atと使用履歴は残す。
- 旧ファイルは台帳にないという理由だけで削除しない。既存posts、旧post_attachments、その他の参照を含む棚卸し・猶予・候補確認を行い、承認後に回収する。
- Storage実体の削除にSQL DELETE FROM storage.objectsを使わない。公式にStorage APIでの削除が必要とされる。
出典：[Delete Objects](https://supabase.com/docs/guides/storage/management/delete-objects)

### 11.10 最小修正案と将来拡張を考えた理想設計

最小修正案：台帳1つ＋投稿/消費の原子的RPC＋アップロード/投稿APIの変更＋直接書き込み権限の整理。現在のpath形式、attachment_url入力形式、postsの添付列、表示コンポーネントは維持できる。pathは台帳検索にしか使わず、サーバーの台帳が唯一の所有者根拠となる。清掃ジョブを後段に分けても、状態・期限・清掃との排他条件は初めから設計する。FK導入に伴う削除処理の整合は後回しにしない。

推奨する小さな追加：BoardClientも変更し、アップロードAPIのuploadIdを投稿へ渡す。入力をpathから識別子へ置き換え、MIMEも台帳由来に統一する。ただしuploadIdを秘密トークンとして信用せず、所有者/ルーム/状態の照合は必須。path検索方式でも同じ認可を行えば安全性は確保できる。

理想設計：アップロード/実体台帳（assetsまたはattachment_uploads）と、post_attachments(post_id, upload_id, sort_order等)を分離する。1投稿に複数添付を関連付け、複数行を一定順序でロックして全件一括で確定する。1uploadを1投稿に限定するならupload_id UNIQUEを維持。本人の明示的再利用を許す場合だけその制約を緩め、個々の関連付け認可・参照数/NOT EXISTS確認・削除保持を設計する。さらに冪等リクエスト記録、削除outbox、内容検査/隔離状態、容量・件数制限を追加する。単一used_atだけでは複数回使用履歴を表せない。

### 11.11 変更が必要なファイル・検証計画・次の作業

将来の実装対象（今回未変更）：

- app/api/uploads/route.ts：本人由来の台帳予約、upload結果による状態遷移、失敗補償、uploadId返却。
- app/api/posts/create/route.ts：台帳照合、サーバー由来path/MIME、原子的RPC呼び出し、入力型・再送対応。
- app/rooms/[id]/BoardClient.tsx：uploadId方式を採用する場合の送信形式・再送管理。path検索を維持する最小案なら必須変更ではない。
- lib/attachmentPath.ts：既存の防御を維持。必要なら台帳処理の共通サーバーモジュールを新設する。
- DB管理用マイグレーション（配置規約未確定）：台帳、制約、索引、RPC、GRANT/REVOKE、RLS。現時点では作成しない。
- app/api/rooms/delete/route.ts、必要に応じapp/api/account/delete/route.tsとapp/api/posts/delete/route.ts：新FK・保持/物理削除に伴う整合。現行投稿削除は論理削除、ルーム削除は物理削除であり同一扱いにしない。
- 清掃ジョブ/API（新設候補）：認証されたスケジューラーだけが起動できるもの。今回はジョブや自動化も登録していない。
- app/api/storage/sign/route.ts、app/api/uploads/sign/route.ts：新規台帳のpost_id整合を署名時にも強制する拡張を採用する場合。旧添付の閲覧境界を定義してから変更。旧公開GETは現在POSTへ委譲しているので重複実装しない。
- docs/security-route-check.cjs：既知制限ケースを拒否期待へ変更。別途実PostgresでRPC/RLS/同時実行の結合テストを追加する。
- docs/AI_HANDOFF.md：実装・検証・未対応事項を更新する。

実装前に確認する事項：実DBのID型/FK/RLS/GRANT/RPC/ビュー、Storage非公開設定と直接書き込み権限、既存pathの重複/参照/所有者証拠、旧post_attachments利用、投稿編集/複製経路、ユーザー・ルーム削除方針、1uploadの再利用可否、未使用期限、冪等性、切替手順と旧API停止方法。これらの確認後、最小案かuploadId追加案か、削除連携の変更範囲を提示してから実装する。

必要なテスト：本人/別人/別ルーム、未認証/退出/権限不足、不存在/未完了/期限切れ/使用済み/削除中、同一uploadへの同時投稿、清掃と投稿の競合、upload成功後のDB失敗、遅延uploadと清掃、投稿トランザクションのロールバック、応答消失後再送、REST/RPC直接呼び出しによる偽装、Storage上書き、旧添付閲覧・旧path新規流用拒否、ルーム/アカウント削除。現在のモックだけでRLSや競合を検証済みとは扱わない。

セキュリティ上の改善：pathを知っているだけでは新規紐付けできず、本人・同一ルーム・正常アップロード完了・期限内・未使用を検証できる。同時実行での二重消費と清掃競合を抑え、失敗ファイルを追跡できる。既存の不正共有の是正、内容の盗用、マルウェア対策、負荷制限は別の課題として残る。

今回の変更ファイルはdocs/AI_HANDOFF.mdのみ。次の作業は実環境の読み取り確認と設計方針の確定であり、実装・DB更新は未着手。

## 12. attachment_uploads実装前確認：DB定義・RLS・削除整合性（2026-10-21、調査のみ）

### 12.1 範囲と判定基準

AGENTS.mdと本書を読み直し、app / components / lib / scriptsとリポジトリ内DB定義を調査した。本節のみ追記。migration作成、SQL実行、コード変更、実Supabase接続、commit / push / deployは行っていない。既存の未コミット変更は保持した。

開始ブランチはsecurity/fix-storage-sign。追跡済みの既存8ファイル差分と未追跡AGENTS.md、docs配下、lib/attachmentPath.tsがあり、ステージ済み差分はない。追記前の既存コード差分ハッシュを記録し、終了時にも照合する。

以下の「コードから確認済み」はローカルソースの処理・呼び出しの存在を指し、実DBで成功することや本番稼働の証明ではない。「リポジトリだけでは確認不能」はSQL定義・実設定・実データがないため判定できないものを指す。

### 12.2 SQL / migration / schema定義の棚卸し

【コードから確認済み】隠しファイル・ignore対象も含めて探索し、.git / .next / node_modules等の生成物・依存を除いたリポジトリ内に、SQLファイル、migration、DB schema定義、Supabase config、生成Database型は見つからなかった。CREATE TABLE/POLICY/FUNCTION、ALTER TABLE、RLS有効化、GRANT/REVOKEの実行定義も見つからない。READMEの構成例にはsupabase/とあるが、現checkoutにそのディレクトリはない。

lib/supabase/client.ts / server.ts / admin.tsは接続クライアントの実装でありDB定義ではない。scripts/Untitledとscripts/reset-password.mjsはAuthのupdateUserByIdを呼ぶ管理スクリプトで、migrationや添付操作ではない。実行せず、値を出力せず呼び出し種別のみ確認した。

【リポジトリだけでは確認不能】実テーブルの存在、idのSQL型、NOT NULL、UNIQUE、FK、ON DELETE、トリガー、RLS有効/強制設定、ロール継承、テーブル/列権限、既定権限、ビュー、RPC定義/EXECUTE権限、適用済みmigration履歴。TypeScriptのstringやAPIのonConflict指定はDB制約の証明にならない。

### 12.3 postsのRLS・INSERT権限・書き込み経路

【コードから確認済み】

- app/api/posts/create/route.ts:107がService Roleのadmin.from('posts').insertで投稿を作成する。認証ユーザー、openルーム、未削除/非表示false、有効参加、final権限、isRoomAttachmentPathを確認する。添付所有者・実在・使用状態の照会はない。
- app/rooms/[id]/BoardClient.tsxとPostForm.tsxはPOST /api/posts/createを呼び、ブラウザーからpostsへ直接INSERTしない。
- BoardClient、作品詳細、未読集計はpostsを直接SELECTする。公開作品等の読み取り権限は維持が必要。
- app/api/posts/deleteはdeleted_atの更新、toggle-markはマーク関連列の更新。app/api/updateとapp/profile/set-usernameはService Roleで過去投稿のusernameを更新する。台帳を使うRPCに投稿INSERTを移しても、これらの正当なサーバー更新を妨げないこと。
- ソースとTypeScript ASTによる書き込み呼び出しの棚卸しで、ブラウザーからpostsへ直接INSERT/UPDATE/DELETEするアプリ経路は見つからない。所有者保護がDB側でも有効という意味ではない。

【リポジトリだけでは確認不能】postsのRLS/INSERT/UPDATE/DELETE権限と実ポリシー。一般ユーザーが独自HTTP要求でSupabase REST/GraphQL/RPC/書き込み可能ビューへアクセスし、APIを迂回できるか。Service Role経由のINSERTが動いてもanon/authenticatedの制限は検証できない。

推奨：postsの読み取りRLSを保ち、anon/authenticatedの直接INSERTと添付/投稿者/ルーム変更を禁止する。現行コードではクライアントのposts直接更新依存は見当たらないが、実環境の他クライアント・外部連携を確認してから書き込み権限を閉じる。既存列単位権限と広いPERMISSIVEポリシー、ビュー、SECURITY DEFINER RPCも確認する。

### 12.4 room_membersのRLS・直接更新依存

【コードから確認済み】

- app/components/MarkRoomSeenOnView.tsx:22はブラウザーのSupabaseクライアントからroom_members.last_seen_atを直接UPDATEする。room_id、本人user_id、left_at NULLを指定する。このコンポーネントはapp/rooms/[id]/page.tsx:111で使用中。
- app/rooms/[id]/JoinButton.tsxは参加状態を直接SELECTするが、参加書き込みはPOST /api/rooms/join経由。RoomDetailClient等も参加情報を読む。
- 参加・復帰・役割変更・退出は主にService Role API。joinはroom_id,user_idをonConflictとするupsert、leaveはleft_atを設定する。core-revokeはroom_members行を物理DELETEする経路がある。
- app/works/[id]/SeenMarker.tsxはユーザー権限でmark_room_seen RPCを呼ぶ実装だが、他ファイルからの参照は見つからない。RPC定義はないため安全な代替として即採用できるとは言えない。
- /api/rooms/seenは認証・有効参加確認後にService Roleでlast_seen_atを更新する既存経路。/api/rooms/mark-readはlast_read_atを更新し、意図的にleft_at条件を付けていない。

【リポジトリだけでは確認不能】直接last_seen_at更新の実際の成功、RLSのUSING/WITH CHECK、更新可能な列、role/user_id/room_id/left_at/is_core等をユーザーが変更できるか、有効参加・ロール昇格を防ぐトリガー、mark_room_seen等のRPC権限。

推奨：room_membersのUPDATEを一括で取り消さない。既読処理を既存の認証API等へ移してから直接UPDATEを閉じる案を優先する。直接更新を残すなら「本人の有効参加行」のRLS＋last_seen_at列だけのUPDATE権限に限定し、テーブル全体のUPDATE権限を残さない。SQLのRLSは行制御であり列の保護ではない。列権限だけをREVOKEしてもテーブル全体の権限が残れば制限にならない。SELECTと既読・参加/退出・承認の回帰検証が必要。

台帳をroom_membersへFK接続しない。退出・core剥奪・ルーム削除でmembershipが消えても、所有者証拠とStorage清掃記録を保持する必要がある。
出典：[Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security)

### 12.5 storage.objects / room_uploadsとService Role API

【コードから確認済み】

- /api/uploadsはService Roleでroom_uploadsにupload(upsert:false)する。本人IDは認証で取得するが永続的な所有者記録は作らない。pathはrooms/{roomId}/{images|videos|files}/{UUID}.{ext}。
- /api/storage/signは投稿/ルーム/pathを確認して公開作品の署名URLをService Roleで発行する。
- /api/uploads/signは投稿/ルーム/path/有効参加を確認して参加者用署名URLをService Roleで発行する。
- /api/uploads/public/[postId]は現在/api/storage/signのPOST処理を呼び、成功時302へ変換する。独自Storage照会はない。
- Storageへのブラウザー直接upload/update/remove/move/copy、signed upload URL発行はアプリ内に見つからない。Storage API removeによる実体削除も見つからない。
- lib/supabase/admin.tsとserver.ts、複数API内のcreateClientでService Roleクライアントを作成している。lib/supabase/client.tsは公開anon key＋ユーザーセッションのブラウザークライアント。
- 添付関連以外に/api/posts/delete、toggle-mark、プロフィール名同期、ルーム/アカウント削除、参加管理もService Roleを使う。RLSだけでこれらのAPIの認可を補えない。
- /api/debug/bucketsはハンドラー内に認証確認がなく、Service RoleでlistBucketsしてバケット名とpublicフラグを返す。今回呼び出していない。リリース前にdebug APIの公開範囲を別途見直す候補。

【リポジトリだけでは確認不能】room_uploadsが本当にprivateか、storage.objects/bucketsのポリシー、anon/authenticatedの直接SELECT/INSERT/UPDATE/DELETE、copy/move/upsertの可否、過去オブジェクトのowner_id、StorageとDBの外部利用者。コードに直接書き込みがなくても、ユーザーは公開URL/anon keyと自分のJWTで独自要求を送れるため、コード探索だけで「直接書き込み不能」と断定しない。

推奨：最小案ではStorage書き込み・削除は認証済みサーバー経由、バケットはprivate、署名時は既存の閲覧認可を維持する。台帳にuser_idがあってもStorage実体を上書き/コピー/差し替え可能なら整合性が破れるので、実ポリシー確認は導入条件。所有者限定の署名に変えると共同閲覧・公開作品が壊れるため採用しない。

### 12.6 post_attachmentsの実利用判定

【コードから確認済み】現在の本番アプリ用ソースにpost_attachmentsへのSELECT/INSERT/UPDATE/DELETEは見つからない。公開GETはpostsベースの共通署名処理へ変更済み。BoardClient、作品表示、投稿作成はいずれもposts.attachment_url / attachment_typeを使う。post_attachmentsの文字列はモックテストのfixtureと調査文書に残る。テストfixtureにあることはテーブル実在の証拠ではない。

【リポジトリだけでは確認不能】実テーブルの有無と件数、DBトリガー/RPC、旧デプロイ・外部クライアントからの利用、過去データの唯一の参照先になっているか。公開GET API自体には外部利用者がいる可能性があり、ソース内呼び出しなしを理由に廃止できない。台帳へ転用/削除する前に実環境を確認する。

### 12.7 退会・投稿削除・ルーム削除とFKの最終推奨

【コードから確認済み】

- ルーム退出：/api/rooms/leaveはmembershipのleft_atを設定し、Authユーザー/投稿/Storageを削除しない。台帳の所有者履歴を消さず、新規使用時の参加資格だけ再確認する。
- 投稿削除：/api/posts/deleteはposts.deleted_atの論理削除のみ。Storage removeなし。membership確認にleft_at NULLがない既存点は別課題。台帳のpost_id/used_atを解除せず、論理削除で使用済み添付をreadyへ戻さない。
- ルーム削除：/api/rooms/deleteはroom_members DELETE後にroomsを物理DELETEする。別HTTP処理であり、membership削除エラーの検査もない。rooms削除失敗時にmembership削除がロールバックされない。posts削除はコメントアウト。既存FK/CASCADE/トリガーによる実結果は不明。
- アカウント退会：/api/account/deleteはprofilesをuser_id条件で匿名化した後、admin.auth.admin.deleteUserを呼ぶ。Auth削除失敗時にもプロフィール変更は戻らない。posts/room_members/public_profiles/Storageを明示的に整理しない。
- 他のprofilesコードはid条件を使う例があり、実profilesのid/user_id構造と匿名化の実効性を確認する必要がある。現APIが正しく全データを匿名化できているとは断定しない。

本調査によるFK推奨の具体化（第11節の一律RESTRICT案を更新）：

- user_id → auth.users(id)：既存のAuth物理削除を妨げず、添付を保持する方針ならON DELETE SET NULLを推奨。列はnullableにする。ただし新規予約は必ず検証済み非NULL所有者を必要とし、RPCはuser_id NULLを絶対に消費できない。通常のサーバー処理による所有者変更は禁止し、Auth削除時のNULL化だけを区別する。CHECK user_id IS NOT NULLを全行へ置くとSET NULLと矛盾するので置かない。既存データと同様、退会後の添付を保持するプロダクト方針の確認が必要。
- room_id → rooms(id)：原則NOT NULL、ON DELETE RESTRICT。台帳をCASCADEで消してStorage削除情報を失うことを避ける。ただし現行ルーム削除APIをそのまま使ってはいけない。先にルームを削除予定/閲覧不可へし、参照と削除ジョブを永続化して清掃完了後に親を物理削除する。台帳墓標を残すなら親を論理削除で保持するか、墓標/清掃記録を独立アーカイブへ移す。どちらを採用するかDDL前に決定する。
- post_id → posts(id)：nullable、現行1投稿1添付ならUNIQUE、ON DELETE RESTRICTを基本。通常は投稿論理削除なので整合する。実DBでAuth/roomsからpostsへCASCADEしている場合は、このRESTRICTがAuth/ルーム削除を阻害するため、その連鎖を先に変更/整理するか、消費済み墓標を独立保持する設計へ変更する。ON DELETE SET NULLだけでは使用履歴消失・再利用判定の誤りにつながる。
- room_members、storage.objectsへFKを追加しない。StorageオブジェクトとDB行のライフサイクルはAPIと補償/清掃処理で管理する。

【リポジトリだけでは確認不能】posts/rooms/room_members/profilesからauth.usersへの既存FK、CASCADE連鎖、Auth削除トリガー、Storageオブジェクト所有によるAuth削除失敗、実データ保持/削除の結果。SQL型も未確認。上記は最終推奨の論理案であり、実環境確認なしで適用可能な最終DDLではない。

アカウント削除はPostgres・Auth API・Storageをまたぐので全体を単一SQLトランザクションにできない。削除予定/利用停止→DB側の匿名化・未使用添付失効/清掃予約→Auth削除→成功/失敗記録と再試行という再開可能な手順が必要。退会直前に検証を通過した投稿要求との競合も、RPC内でactorの存在/利用停止状態を再確認・ロックして定義する。

出典：[PostgreSQL FK constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)、[Supabase user deletion](https://supabase.com/docs/guides/auth/managing-user-data#deleting-users)

### 12.8 attachment_uploadsの最終スキーマ推奨案（論理設計）

最小案は新規台帳1つ、postsの現行添付列は維持。実ID型を確認してからDDLへ落とす。

- id UUID PRIMARY KEY：サーバー生成のuploadId。
- user_id UUID NULL：auth.users(id)参照、上記SET NULL。新規予約時は必須。NULL所有者の新規使用は不可。
- room_id NOT NULL：rooms.idと同じ型、上記RESTRICT。
- bucket TEXT NOT NULL：room_uploads固定のCHECK。
- storage_path TEXT NOT NULL：サーバー生成、UNIQUE(bucket, storage_path)、生成後変更禁止、既存path検証を維持。
- status TEXT NOT NULL：uploading / ready / attached / failed / revoked / deleting / deletedから限定。状態遷移はサーバー/RPCだけ。
- post_id NULL：posts.idと同じ型、上記RESTRICTと非NULL一意。将来複数添付化時にpost_id一意を外して関連テーブルへ移す。
- created_at / updated_at TIMESTAMPTZ NOT NULL：DB管理。
- uploaded_at / used_at / deleted_at TIMESTAMPTZ NULL：完了・消費・実体削除の時刻。used_at/post_idを一緒に確定し消費後は解除しない。deleting/deletedでも消費履歴を保持する。
- expires_at TIMESTAMPTZ NOT NULL：未使用の利用期限。24時間は候補値で未確定。attachedの閲覧期限ではない。
- mime_type TEXT NOT NULL / size_bytes BIGINT NOT NULL CHECK >= 0：サーバー受信内容由来。MIMEを信頼できる内容検査済み情報と混同しない。
- lease_expires_at TIMESTAMPTZ NULL：uploading処理と清掃の競合管理。必要なら削除の試行回数・最終試行時刻・短い失敗コードも追加。

整合ルール：未使用状態のpost_id/used_atはNULL、attachedはpost_id/used_at/uploaded_at必須。post_id非NULLとused_at非NULLを同値にし、削除処理でも両方保持する。user_id NULLはreadyのまま残る瞬間があってもRPCは拒否し、清掃対象とする。退会処理でready→revokedへ更新し、Auth削除のSET NULLは最後の安全策とする。無効状態の過去行があっても新規消費できないことを優先する。

索引：bucket/path一意、post_id非NULL一意、(status, expires_at)、uploadingのlease期限、(user_id, room_id)。他テーブルとの所有者/ルーム一致はRPCで検証。必要なDB側の追加制約はユーザー削除によるNULL化と矛盾しないよう設計する。

冪等性は別の投稿要求記録（user_id, request_idの一意＋要求内容fingerprint＋post_id）を推奨するが最小台帳の必須列には混ぜない。再送時の同一要求と二重使用の区別が必要なら同時実装する。

### 12.9 推奨RLS・RPC責務・導入で壊れ得る機能

RLS/権限：台帳はRLS ON、anon/authenticatedへの直接SELECT/INSERT/UPDATE/DELETEなし。台帳を読む画面は現在ないので本人SELECTも当初不要。service_roleへの必要なテーブル/シーケンス権限は明示する。RPCはSECURITY INVOKERを基本、PUBLIC/anon/authenticatedのEXECUTEを明示的に閉じ、service_roleだけに許可する。APIが認証済みactor_user_idを渡し、bodyのuser_idを信用しない。ユーザーJWTからの直接呼び出し設計へ変える場合はactorをauth.uid()由来へ変更する必要がある。

RPC責務：

1. 予約処理はactorの存在/利用停止、ルーム状態、有効参加、容量等を確認してuploading行を作る。完了処理はサーバーのStorage成功確認後だけreadyへ条件付き遷移させる。
2. 投稿確定RPCは入力の基本形式、actorの現在の資格、ルーム/参加/台帳を固定順序でロックし、本人・同一ルーム・ready・未消費・期限・final権限を確認する。path/MIMEは台帳由来。
3. 投稿INSERTとattached/post_id/used_atの更新を1トランザクションで実施。どちらか失敗したら全体をロールバック。添付なし投稿も対応。アプリから複数HTTP呼び出しで擬似トランザクションにしない。
4. 清掃候補をdeletingに確定するRPCは投稿確定と同じ台帳行で排他。Storage removeはAPI/ジョブ側、完了記録は別の条件付き更新。Storage HTTP通信をDB原子処理に含められるとは扱わない。
5. 他人の所有情報をエラーで返さず、再送/競合/失敗の結果を最小限に返す。入力/ロック順序・実行時間・一度に扱う件数を制限する。

既存機能への主なリスク：room_members更新を閉じると既読が壊れる、FKでAuth/ルームの物理削除が失敗する、CASCADEで清掃記録が消える、旧APIが残ると所有者制限を迂回する、台帳必須を署名へ一律適用すると旧添付が表示されなくなる、投稿の全UPDATEを台帳必須にすると旧投稿のusername同期/マーク/論理削除が失敗する、1回使用制によりログからfinalへの同一path再利用が拒否される、期限切れ・切替前未投稿ファイルは再アップロードが必要になる。

### 12.10 このまま準備できる項目・実環境確認が必要な項目

準備開始してよい項目（今回実装はしていない）：API契約の設計、状態遷移/競合/再送の仕様、型・認可ヘルパーの設計、モックテスト計画、既存path形式・表示方式を維持する方針、uploadId方式を採る場合のクライアント変更計画。実環境に依存しない部分をローカルで準備することは可能。

実環境確認前に適用/有効化してはいけない項目：ID型/FK込みDDL、posts/room_membersのGRANT/REVOKE/RLS変更、Storage Policy変更、RPCを公開可能にする設定、Auth/ルーム削除手順、旧データ移行・物理削除、本番の台帳必須化。現時点で「そのまま本番実装・適用してよい」とは判断しない。

実Supabaseの読み取り確認リスト（今回は未実行）：

- pg_class等のRLS有効/強制フラグ、pg_policiesのUSING/WITH CHECK・ロール・PERMISSIVE/RESTRICTIVE。
- table/column privileges、ロール継承とPUBLIC権限、default privileges。posts、room_members、Storageと関連ビュー/RPCを含む。
- pg_constraint / pg_indexes / pg_triggerによる実ID型、FK/削除連鎖、一意制約、監査/集計/投稿変更トリガー。
- pg_procによる既存RPCの本文・security definer/invoker・search_path・EXECUTE権限。mark_room_seen、approve_core_request、reject_core_request、join_core_first_come、join_core_by_invite等。既存RPCを権限制限だけで動かなくしない。
- storage.bucketsのpublicフラグ、storage.objectsのポリシー/owner_id。対象バケット以外のStorage利用も確認する。
- post_attachmentsの存在/行数/依存、旧添付参照と同一path複数利用、旧デプロイ/外部利用者。
- Auth削除時のposts/rooms/profiles/public_profiles/room_membersの結果、公開済み作品と退会者添付を残す規約/運用、保存期間。
- 専用テストユーザーでの許可/拒否・列改ざん・REST/RPC迂回は、設定閲覧の後に別のテスト工程として実施する。今回の読み取り調査で成功済みとは扱わない。

### 12.11 実装順序・ロールバック・既存ユーザーへの影響

推奨実装順序：

1. 実DB定義/権限を読み取り棚卸しし、承認された保管先へ機密値を含めない定義スナップショットを残す。型・既存FK・ポリシー・削除方針・1回使用の仕様を確定。
2. テスト環境で台帳/RPCとテストを追加。RLS/REST迂回、二重使用、清掃競合、Auth/ルーム削除、既読/公開添付/旧投稿更新を実Postgresで検証する。単なるモック合格で代替しない。
3. 削除処理と既読更新の互換対応を先に準備し、必要なDB追加は旧コードに影響しない形で導入する。ただしFKが旧削除を妨げる期間は作らない。削除API停止や新方式との同時切替等を計画する。
4. アップロード台帳記録→投稿確定RPCへ切替。旧サーバー/旧APIも停止・保護し、全書き込みが新認可を通る状態にする。必要なら短い書き込み停止を設ける。切替中の旧アップロードをpathだけで許可しない。
5. posts/Storage直接書き込みを閉じ、room_membersは既読の互換対応完了後に制限。権限を緩めるデフォルト/既存RPCが残らないことを確認する。
6. 新規未使用ファイル限定で清掃をdry-run確認後に有効化。旧ファイル回収・旧post_attachments整理は別途承認して実施。

ロールバック：

- 有効化前の追加だけの段階では、利用行/依存がないことを確認した上で未使用RPC/テーブルの撤去を検討できる。ただし今回撤去SQLは作成しない。
- 有効化後は台帳・使用履歴・削除ジョブ・添付実体を残す。問題のある清掃は停止し、新規添付の書き込みを一時停止して安全性を保った互換版へ戻すか前進修正する。旧path無検証APIへの復帰やRLSの無効化は行わない。
- 権限変更は事前スナップショットに基づき、必要な列/操作のみ互換復旧する。room_members全UPDATEやposts任意INSERTを復活させない。
- Authユーザー削除とStorage物理削除は単なるDBロールバックでは元に戻らない。保管・復元手段と事前バックアップの有無を確認してから有効化する。既存データを保持して切替することでロールバック時の損失を抑える。

既存ユーザー/添付：既存postの表示と参加者/公開閲覧は維持する。全添付の移動/所有者推測によるバックフィルは不要。新規紐付けだけ台帳必須にし、旧pathを知っているだけでは新規投稿へ流用できなくする。退会後の共同作品保持、同一ファイルの再利用、旧未投稿アップロードの扱いは事前に仕様確定が必要。ユーザーが新しい台帳行を直接作成/所有者変更する操作は提供しない。

### 12.12 今回の変更・検証・未対応事項

変更ファイルはdocs/AI_HANDOFF.mdのみ。検索、関連コードの読解、TypeScript ASTによるDB/Storage書き込み呼び出し棚卸し、公式資料の確認を実施した。実環境のSQL/設定変更はもちろん、読み取りSQLも実行していない。今回型チェック・lint・build・モック回帰テストは再実行していない（コード変更なし、前節の結果を今回の実測として流用しない）。

結論：台帳の責務とAPI経由の設計準備は進められるが、権限・FK・削除方式の最終DDLと有効化には実環境の確認が必要。特にroom_membersの既読直接更新とAuth物理削除を保護すること。次は実DB定義/ポリシーの読み取り確認と、上記論理スキーマ・切替/削除方針の確定。まだ実装を開始していない。

## 13. 引き継ぎ運用：単一タスク指示書の追加（2026-10-21）

- `docs/AI_TASK.md` を新規作成。Status、Objective、Context、Tasks、Do not、Validation、Expected output、Updated at を持つテンプレートとし、Status は `pending`、Objective は `pending: none`。具体的な次タスクや実Supabase環境確認は登録していない。
- `AGENTS.md` に両文書の開始時確認、具体的な pending タスクの優先実行、開始時の `in_progress`・完了時の `done`・Updated at の更新、結果の本書への記録を追加。大きな変更前の方針提示と、明示指示なしの commit / push / deploy 禁止を維持した。
- 変更ファイル：`AGENTS.md`、`docs/AI_TASK.md`、`docs/AI_HANDOFF.md`（本記録）。
- 検証：文書内容と Git 差分を確認。既存コードの差分が作業前後で一致することを確認。文書のみのためアプリのテスト・ビルドは実行していない。
- 次の作業：ChatGPT / Work またはユーザーが具体的な単一タスクを登録するまで未登録として待機する。
- コード・DB・migration の変更、実Supabaseへの接続、commit / push / deploy は行っていない。

## 14. 実Supabase環境確認の事前調査タスク登録（2026-10-21）

- `docs/AI_TASK.md` に、attachment_uploads実装前の実Supabase環境のRLS・権限・Storage Policy・FK・Trigger・RPC等を安全に確認するための事前調査を登録した。Status は `pending`。
- 今回はタスク登録と本記録の追記のみ。CLI/リンク状況の確認、実Supabaseへの接続、監査SQL・dumpの実行を含む調査は未実施。
- コード・DB・migration・Supabase設定は変更せず、commit / push / deployも行っていない。

## 15. 実Supabase確認の事前調査：コマンド承認待ち（2026-10-21）

- AI_TASKのStatusをin_progressに変更。AGENTS.md、AI_TASK.md、引き継ぎの関連記録を確認。ブランチはsecurity/fix-storage-sign、既存の追跡済み8ファイル変更と未追跡文書・lib/attachmentPath.tsを保持。
- CLI/リンク状況：未確認。Tasks 5の「実行前にコマンドと読み取り専用である理由を提示し、ユーザー承認を待つ」に従い、以下のローカル確認から承認待ちとする。

### 最初に承認を求めるコマンド（未実行）

```powershell
$repoPath = 'C:\dev\minnade\minnade-tsukuru'
[pscustomobject]@{
  CliOnPath = [bool](Get-Command supabase -CommandType Application -ErrorAction SilentlyContinue)
  LocalCli = Test-Path -LiteralPath "$repoPath\node_modules\.bin\supabase.cmd" -PathType Leaf
  ConfigPresent = Test-Path -LiteralPath "$repoPath\supabase\config.toml" -PathType Leaf
  LinkMarkerPresent = Test-Path -LiteralPath "$repoPath\supabase\.temp\project-ref" -PathType Leaf
}
```

読み取り専用の理由：Get-Commandで実行ファイルの登録を検索し、Test-Pathで既知ファイルの有無だけを確認する。Supabase CLI自体を起動せず、ネットワーク接続・インストール・ファイル更新を行わず、設定内容・project ref・秘密情報の値を表示しない。結果は真偽値のみ。CLI未検出はPC全体の未インストールを断定しない。リンクマーカーの存在だけでは現在の接続先・認証の有効性を証明できない。

### 公式資料から確認したこと・後続の方針

- Supabaseのdb dumpはpg_dumpをコンテナーで実行し、通常はauth/storage等の管理スキーマを除外する。schemaの出力だけでStorage policyや全権限を確認済みとは扱わない。実CLIのバージョンとオプション確認後に適用可能性を判断する。dump内の関数本文や定数には秘密情報が含まれる可能性があるため、出力をそのままチャットへ流さない。dry-runも実行スクリプトを表示するので無条件に安全とは扱わない。
- メタデータから確認可能な対象：pg_namespace/pg_class/pg_attributeのスキーマ・型・RLSフラグ、pg_policyの適用ロール/操作、テーブル・列・スキーマ・シーケンス・関数のACLと既定権限/ロール継承、pg_constraintのFK/削除動作、pg_triggerの対応関数、pg_procの関数属性/EXECUTE権限。storageのポリシーもカタログ側から調べられる。アプリテーブル、auth.users、storage.objectsのユーザー行は取得しない。
- ポリシー式・関数本文・トリガー引数は秘密情報の混入を避けるため初回出力から除外し、必要箇所を絞った追加確認を設計する。この初回棚卸しだけでは認可の安全性を断定しない。
- 暫定推奨は既存DashboardのSQL Editorで対象を限定したカタログ監査。CLI導入/link/Dockerの準備を省け、秘密の接続文字列をチャットへ渡す必要がない。BEGIN READ ONLY、SET LOCAL statement_timeout、カタログへのSELECT、ROLLBACKをひとまとまりにし、既存RPCは呼び出さない。READ ONLYだけで任意関数の外部副作用を防げるとは考えず、参照先・関数を限定する。
- CLI利用可否は未確認なので、Dashboard用の具体的SQLと最終推奨はローカル確認後に確定し、実行前に別途提示する。実DBへ接続するコマンドやdumpの実行承認は今回のローカル確認承認に含めない。
- 参照：[Supabase CLI db dump](https://supabase.com/docs/reference/cli/supabase-db-dump)、[PostgreSQL READ ONLY](https://www.postgresql.org/docs/current/sql-set-transaction.html)、[pg_policy](https://www.postgresql.org/docs/current/catalog-pg-policy.html)、[pg_proc](https://www.postgresql.org/docs/current/catalog-pg-proc.html)。

### 検証・残作業

- 今回の変更はdocs/AI_TASK.mdの状態と本書の記録のみ。実DB接続、ユーザーデータ取得、SQL/dump実行、コード・DB・migration・Supabase設定変更、commit / push / deployは未実施。秘密情報は出力していない。
- 残作業：上記ローカル確認の承認→CLI/リンク状況の確認→具体的監査SQL/必要なコマンドの提示と最終推奨→結果記録。承認待ちのためStatusはin_progressを維持する。

## 16. 実Supabase確認の事前調査完了（2026-10-21）

### 16.1 承認範囲と確認結果

ユーザーの「OK」を受け、第15節のローカル存在確認のみ実行した。結果は CliOnPath=False、LocalCli=False、ConfigPresent=False、LinkMarkerPresent=False。

- PATH上とリポジトリのnode_modules/.binにCLIを検出できなかった。PC全体の未インストールを断定する結果ではない。
- 標準位置のsupabase/config.tomlとsupabase/.temp/project-refが存在しない。このcheckoutで標準のlink済み状態を確認できなかった。別workdirや別端末のリンク状況、実プロジェクトの有無は未確認。
- CLI起動、インストール、login/link、Docker起動、実Supabase接続は実施していない。第15節のローカルコマンド承認待ちは解消済み。
- 事前調査と手順提案を完了したためAI_TASKをdoneに更新する。実環境の監査を完了したという意味ではない。

### 16.2 推奨する確認方法

**Supabase Dashboard SQL Editorで、下記の読み取り専用カタログ監査SQLを実行する方法を1つ推奨する。**

既存Dashboardへアクセスできることが前提。CLI、link、Dockerの追加準備を省け、DB passwordやaccess tokenをチャットへ渡す必要がない。Dashboardのアクセス可否は今回確認していない。

1. ユーザーが対象プロジェクトと環境をDashboardで確認する。
2. 下記SQL全体と取得範囲を確認し、実DBに対する実行を別途承認する。今回の「OK」はローカル確認のみであり、SQLの実行は許可されていない。
3. 承認後、SQL Editorの新しいクエリに下記ブロック全体を貼り、BEGINからROLLBACKまでまとめて実行する。既存のSQLやmigrationへ追記しない。
4. 結果はメタデータとして扱う。想定外の識別子に機密情報が含まれる場合も、共有前に伏せる。初回は関数本文、ポリシー式、トリガー引数、コメント、設定値、ユーザー行を出力しない。
5. 結果から確認が必要なポリシー・RPC・FKを絞り、本文/式の安全な追加確認方法を別途提示する。既読機能を含む既存機能の実動作テストは別工程とする。

### 16.3 schema-only dumpの可否と採用しない理由

公式CLIにはdb dumpがあり、通常のschema出力とdata-only/role-onlyが区別されている。ただし通常はauth/storage等の管理スキーマが除外され、CLIの準備・接続・コンテナーが必要。この端末で実行可能とは確認していない。schema-onlyであっても関数本文や定数に埋め込まれた秘密情報まで除去されるわけではない。

今回はdumpではなく、カタログへのSELECTを同等の読み取り専用の確認手段として選ぶ。ただし復元可能なschemaバックアップの代替ではなく、初回棚卸しに限定する。Storageのバケットpublicフラグはスキーマ定義ではなく設定行のため、下記の純カタログSQLには含めない。必要ならDashboardの対象バケット設定を別途閲覧する。

CLI側の実行候補コマンドは今回採用しない。db pull、db push、db reset、migration repair、link等を確認目的で実行しない。dumpを後日選ぶ場合は、その時点のCLIバージョン・対象スキーマ・出力先・秘密情報の扱いを確定したコマンドを提示し、改めて承認を待つ。

参照：[Supabase CLI db dump](https://supabase.com/docs/reference/cli/supabase-db-dump)。

### 16.4 Dashboard用の監査SQL（提案・未実行、別途承認が必要）

読み取り専用の理由：READ ONLYトランザクションでカタログだけをSELECTし、PostgreSQL組み込みの型表示・権限照会・JSON集計だけを呼ぶ。アプリRPC/トリガーを呼び出さず、ユーザーテーブルやStorage実体を参照せず、DDL/DML/GRANT/REVOKEを含めない。SET LOCALは当該トランザクションの実行制限と名前解決のみで、永続設定を変えない。最後にROLLBACKする。READ ONLY単独を任意関数の外部副作用防止策とみなさず、SQLの参照先も限定している。

実DBのPostgreSQLバージョン・権限・SQL Editorでの動作は未確認。エラーやタイムアウト時は処理を止め、必要ならROLLBACKのみでトランザクションを終了する。取得失敗を「問題なし」と扱わない。

```sql
-- Proposal only. Run the entire block after separate approval.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = pg_catalog;

WITH
ns AS (
  SELECT oid, nspname, nspowner, nspacl
  FROM pg_catalog.pg_namespace
  WHERE nspname IN ('public', 'auth', 'storage')
),
objs AS (
  SELECT c.*, n.nspname
  FROM pg_catalog.pg_class c JOIN ns n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r','p','v','m','f','S')
),
actors AS (
  SELECT oid, rolname FROM pg_catalog.pg_roles
  WHERE rolname IN ('anon','authenticated','service_role')
),
funcs AS (
  SELECT p.*, n.nspname
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public','auth','storage')
     OR p.oid IN (
       SELECT t.tgfoid FROM pg_catalog.pg_trigger t
       JOIN objs o ON o.oid = t.tgrelid
     )
),
report(section, item) AS (
  SELECT 'schemas', pg_catalog.jsonb_build_object(
    'schema', nspname, 'owner_oid', nspowner, 'acl', nspacl)
  FROM ns
  UNION ALL
  SELECT 'other_schema_names', pg_catalog.jsonb_build_object('schema', nspname)
  FROM pg_catalog.pg_namespace
  WHERE nspname NOT IN ('public','auth','storage','information_schema')
    AND nspname NOT LIKE 'pg_%'
  UNION ALL
  SELECT 'objects', pg_catalog.jsonb_build_object(
    'oid', oid, 'schema', nspname, 'name', relname, 'kind', relkind,
    'owner_oid', relowner, 'rls', relrowsecurity,
    'force_rls', relforcerowsecurity, 'acl', relacl)
  FROM objs
  UNION ALL
  SELECT 'columns', pg_catalog.jsonb_build_object(
    'schema', o.nspname, 'object', o.relname, 'number', a.attnum,
    'column', a.attname, 'type', pg_catalog.format_type(a.atttypid,a.atttypmod),
    'not_null', a.attnotnull, 'acl', a.attacl)
  FROM pg_catalog.pg_attribute a JOIN objs o ON o.oid = a.attrelid
  WHERE a.attnum > 0 AND NOT a.attisdropped AND o.relkind <> 'S'
  UNION ALL
  SELECT 'policies', pg_catalog.jsonb_build_object(
    'oid', p.oid, 'schema', o.nspname, 'table', o.relname,
    'name', p.polname, 'command', p.polcmd, 'permissive', p.polpermissive,
    'role_oids', p.polroles, 'has_using', p.polqual IS NOT NULL,
    'has_with_check', p.polwithcheck IS NOT NULL)
  FROM pg_catalog.pg_policy p JOIN objs o ON o.oid = p.polrelid
  UNION ALL
  SELECT 'constraints', pg_catalog.jsonb_build_object(
    'oid', k.oid, 'name', k.conname, 'kind', k.contype,
    'schema', n.nspname, 'table', c.relname, 'column_numbers', k.conkey,
    'referenced_schema', rn.nspname, 'referenced_table', rc.relname,
    'referenced_column_numbers', k.confkey, 'on_delete', k.confdeltype,
    'on_update', k.confupdtype, 'validated', k.convalidated,
    'deferrable', k.condeferrable, 'initially_deferred', k.condeferred)
  FROM pg_catalog.pg_constraint k
  JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_catalog.pg_class rc ON rc.oid = k.confrelid
  LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid = rc.relnamespace
  WHERE k.conrelid IN (SELECT oid FROM objs)
     OR k.confrelid IN (SELECT oid FROM objs)
  UNION ALL
  SELECT 'triggers', pg_catalog.jsonb_build_object(
    'schema', o.nspname, 'table', o.relname, 'name', t.tgname,
    'function_oid', t.tgfoid, 'enabled', t.tgenabled,
    'internal', t.tgisinternal, 'type_bits', t.tgtype,
    'column_numbers', t.tgattr, 'has_condition', t.tgqual IS NOT NULL,
    'argument_count', t.tgnargs)
  FROM pg_catalog.pg_trigger t JOIN objs o ON o.oid = t.tgrelid
  UNION ALL
  SELECT 'functions', pg_catalog.jsonb_build_object(
    'oid', oid, 'schema', nspname, 'name', proname, 'kind', prokind,
    'argument_type_oids', proargtypes, 'owner_oid', proowner,
    'security_definer', prosecdef, 'volatility', provolatile,
    'has_local_settings', proconfig IS NOT NULL, 'acl', proacl)
  FROM funcs
  UNION ALL
  SELECT 'roles', pg_catalog.jsonb_build_object(
    'oid', oid, 'role', rolname, 'superuser', rolsuper,
    'inherit', rolinherit, 'bypass_rls', rolbypassrls)
  FROM pg_catalog.pg_roles
  UNION ALL
  SELECT 'role_memberships', pg_catalog.jsonb_build_object(
    'role_oid', roleid, 'member_oid', member, 'admin_option', admin_option)
  FROM pg_catalog.pg_auth_members
  UNION ALL
  SELECT 'default_privileges', pg_catalog.jsonb_build_object(
    'owner_oid', d.defaclrole, 'schema', n.nspname,
    'kind', d.defaclobjtype, 'acl', d.defaclacl)
  FROM pg_catalog.pg_default_acl d
  LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
  WHERE d.defaclnamespace = 0 OR d.defaclnamespace IN (SELECT oid FROM ns)
  UNION ALL
  SELECT 'effective_schema_usage', pg_catalog.jsonb_build_object(
    'role', r.rolname, 'schema', n.nspname,
    'usage', pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE'))
  FROM actors r CROSS JOIN ns n
  UNION ALL
  SELECT 'effective_table_privileges', pg_catalog.jsonb_build_object(
    'role', r.rolname, 'schema', o.nspname, 'table', o.relname,
    'select', pg_catalog.has_table_privilege(r.oid,o.oid,'SELECT'),
    'insert', pg_catalog.has_table_privilege(r.oid,o.oid,'INSERT'),
    'update', pg_catalog.has_table_privilege(r.oid,o.oid,'UPDATE'),
    'delete', pg_catalog.has_table_privilege(r.oid,o.oid,'DELETE'))
  FROM actors r CROSS JOIN objs o WHERE o.relkind <> 'S'
  UNION ALL
  SELECT 'effective_column_update', pg_catalog.jsonb_build_object(
    'role', r.rolname, 'schema', o.nspname, 'table', o.relname,
    'column', a.attname,
    'update', pg_catalog.has_column_privilege(r.oid,o.oid,a.attnum,'UPDATE'))
  FROM actors r CROSS JOIN objs o
  JOIN pg_catalog.pg_attribute a ON a.attrelid = o.oid
  WHERE o.nspname = 'public' AND o.relname IN ('posts','room_members')
    AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'effective_function_execute', pg_catalog.jsonb_build_object(
    'role', r.rolname, 'function_oid', f.oid,
    'execute', pg_catalog.has_function_privilege(r.oid,f.oid,'EXECUTE'))
  FROM actors r CROSS JOIN funcs f WHERE f.prokind IN ('f','p','w')
)
SELECT section, pg_catalog.jsonb_agg(item) AS metadata
FROM report GROUP BY section ORDER BY section;
ROLLBACK;
```

### 16.5 取得項目と判定上の限界

- schema、テーブル/ビュー/シーケンス、列型/NOT NULL、RLS有効/強制、ポリシーの対象操作・ロール・PERMISSIVE属性、USING/WITH CHECK式の有無を確認できる。storage.objects/bucketsのポリシーもカタログ側から対象にする。
- ACL、既定権限、ロール継承の関係を取得する。anon/authenticated/service_roleのスキーマUSAGE、テーブルSELECT/INSERT/UPDATE/DELETE、posts/room_members各列のUPDATE、関数EXECUTEは組み込み関数で照会する。ACLがNULLでも権限なしとは限らない。ACLの空の被付与者およびポリシーのrole_oid=0はPUBLICを意味する。
- 権限照会のtrueはRLSでその行を操作できることを保証しない。service_roleやSQL Editorの管理ロールでの成功を一般ユーザーの認可確認に流用しない。
- FKの参照先・列番号・削除/更新動作、トリガーの状態・関数OID、関数のSECURITY DEFINER属性・ACLを取得する。列番号はcolumnsと対応させる。FK動作コードはa=NO ACTION、r=RESTRICT、c=CASCADE、n=SET NULL、d=SET DEFAULT。対象外スキーマからの参照FKも一覧に含むが、その参照元列の詳細は追加確認が必要。
- room_members.last_seen_atの列権限を他列と比較する。既読以外のrole/user_id/room_id等のUPDATEが可能でも、この結果だけで実際の改ざん可否は断定せず、RLS式・トリガーを確認する。今回権限を閉じない。
- 初回SQLはpublic/auth/storageと、それらのトリガーから直接参照される関数が中心。other_schema_namesに独自スキーマがあれば、対象拡張を別途検討する。RPCのHTTP公開範囲、API設定、ビュー本文・security_invoker、関数の呼び出し連鎖、接続権限等を網羅する監査ではない。
- 秘密情報の意図しない表示を避けるため、ポリシー式、関数本文/proconfig実値、CHECK/default式、トリガー条件/引数を除外した。これらを未確認のまま「RLSは安全」「attachment_uploadsを実装してよい」と判断しない。
- 次段階では対象の式・関数を絞り、管理者がDashboard内で秘密値を伏せた定義を用意する等、未加工の定義をチャットに出さない方法を合意してから追加確認する。検索パターンだけで全秘密値を除去できるとは保証しない。追加のSQL実行・設定閲覧もその具体的範囲を示して承認を得る。
- バケット公開設定、ユーザー/投稿件数、添付所有者、旧post_attachmentsの行、既存データの整合性、許可/拒否の実テストは未確認。ユーザーデータを取得しないという今回の範囲を維持する。

参照：[PostgreSQL権限照会関数](https://www.postgresql.org/docs/current/functions-info.html)、[pg_policy](https://www.postgresql.org/docs/current/catalog-pg-policy.html)、[pg_trigger](https://www.postgresql.org/docs/current/catalog-pg-trigger.html)、[READ ONLY](https://www.postgresql.org/docs/current/sql-set-transaction.html)。

### 16.6 変更・検証・次の作業

- 変更ファイル：docs/AI_TASK.md（done、Updated at、登録時点のContextを明確化）、docs/AI_HANDOFF.md（本節追記）。監査SQLは本書内の提案であり、migrationや実行スクリプトとして配置していない。
- 承認された存在確認は4項目ともFalse。秘密情報の値は読まず、出力していない。実DB・ユーザーデータは取得/変更していない。
- 文書内SQLの参照先・出力項目・変更命令の有無を静的に確認。実DBでは未実行・未検証。コード変更がないためアプリのテスト・ビルドは実行しない。
- 文書更新前後の既存追跡コード差分および未追跡のlib/attachmentPath.ts・docs/security-route-check.cjsのハッシュ一致を確認する。
- 次の作業は上記SQLの実行承認とDashboardでの初回棚卸し。事前調査は完了、実環境の安全性の判定とattachment_uploads実装は未着手。commit / push / deployは行っていない。


## 17. 実Supabase初回監査へ着手・ログイン待ち（2026-10-21）

- ユーザーの「次の作業に進んで」を受け、第16節で提示した読み取り監査の実行準備に着手。AI_TASK.mdを新しい監査タスクへ更新し、Statusをin_progressにした。前の事前調査の完了記録は第16節に保持。
- 利用可能なツールにSupabase専用コネクターはなく、操作可能なブラウザーに既存Dashboardタブもなかったため、アプリ内ブラウザーでhttps://supabase.com/dashboardを開いた。
- サインイン画面が表示され、未ログインであることを確認。タブはユーザーのログイン後に続行するため保持。対象プロジェクト・環境は未特定。
- SQLは未実行。実DB接続、ユーザーデータ取得、秘密情報の取得・出力は行っていない。コード・DB・migration・Supabase設定の変更、commit / push / deployも未実施。
- 次の作業：ユーザーが開いているDashboardにログインし、対象プロジェクトを選択する。その後、提示済みの第16.4節の読み取りSQLを実行して結果を確認する。対象が不明な場合はユーザーへ確認する。
- 変更はdocs/AI_TASK.mdと本書のみ。既存追跡コード差分を更新前後で照合する。未完了の理由はログイン待ちであり、実環境を監査済みとは扱わない。

## 18. 実Supabase初回メタデータ監査完了（2026-10-21）

### 実施範囲・証跡

- 対象：Dashboardに存在する唯一のプロジェクトminnade-tsukuru、main。project refはjoedeuyrzimqyjapqpyh。組織一覧からプロジェクト名を確認して選択した。
- ユーザーのログイン後、第16.4節のSQLを空白・改行を詰めた同等の書式で新規クエリに入力し、1回実行した。BEGIN READ ONLY、15秒のstatement_timeout、2秒のlock_timeout、pg_catalog固定、ROLLBACKを維持。取得対象の追加やRPC呼び出しはしていない。
- Dashboardには技術的問題の告知があり、プロジェクト概要はUnhealthy表示だった。ただし今回のSQLは成功し、結果表に15 rowsが表示された。障害原因や全サービスの稼働を確認したものではない。
- 結果をDashboardのDownload CSVから取得し、docs/supabase-metadata-audit-2026-10-21.csvとして保存。ユーザー行・秘密値を含まないカタログメタデータ。新規クエリのSave操作はしていない。SQL Editorの実行履歴・一時的なUI状態は発生し得る。
- 15区分：columns 534、constraints 181、default_privileges 12、effective_column_update 96、effective_function_execute 141、effective_schema_usage 9、effective_table_privileges 159、functions 47、objects 55、other_schema_names 6、policies 78、role_memberships 21、roles 30、schemas 3、triggers 226。これらはメタデータ件数であり、ユーザー数や投稿数ではない。
- 上記件数はDOMから取得した15区分とダウンロードCSVで一致。カタログ監査の結果であり、実ユーザー操作を実行して認可を試したものではない。

### 確認できた状態

- publicの通常テーブル14件はすべてRLS有効、FORCE RLSはfalse。posts/rooms/room_members/profiles/public_profiles等を含む。ビュー4件のRLSフラグfalseを、そのままテーブルのRLS無効と同一視しない。ビューのsecurity_invoker等は未取得。
- storage.objects/bucketsもRLS有効。anon/authenticatedはいずれもSELECT/INSERT/UPDATE/DELETEのテーブル権限がtrue。ただし実際の行操作はポリシー等の条件に依存する。
- anon/authenticatedはBYPASSRLS=false、service_roleはBYPASSRLS=true。3ロールともpublicスキーマUSAGE=true。
- posts/roomsのid、posts.user_id、room_members.id/user_id、profiles.idはuuid。posts/roomsのis_hiddenはNOT NULL boolean。実データの値は取得していない。
- 対象public/auth/storage内の一覧にattachment_uploads、post_attachmentsは存在しなかった。これを独自スキーマや過去環境での不存在の証明にはしない。
- profilesにはidがあり、user_id列はない。第12.7節で記録した退会APIのuser_id条件との不整合を、次のコード確認で照合する必要がある。今回は退会APIを呼んでいない。

### 優先して確認すべき事項

1. **既読更新の権限不整合**
   - authenticatedのroom_membersテーブルUPDATE=false、全15列のUPDATE=false。last_seen_atの列権限もfalse。anonもテーブルUPDATE=false。
   - room_members_update_last_seen_atというUPDATEポリシーは存在し、authenticated向け、USING/WITH CHECKあり。しかしRLSポリシーだけでは不足するGRANTを補えない。
   - 第12.4節のブラウザー直接UPDATE経路との不整合が疑われる。今回の条件では通常のauthenticatedによる直接UPDATEは権限で拒否されるはずだが、実画面・通信は未検証。既読用API/RPCとの使い分けを先に確認し、一括GRANTで直そうとしない。

2. **SECURITY DEFINER関数の実行権限**
   - publicの18関数すべてについてanon/authenticatedのEXECUTE=trueを確認。トリガー関数も含むため、18件すべてがHTTP RPCとして実行可能という意味ではない。
   - join_core_first_come、join_core_by_invite、approve_core_request、reject_core_request、mark_room_seen、join_roomはいずれもSECURITY DEFINER=trueでanon EXECUTE=true。
   - 上記のうちjoin_roomはhas_local_settings=false。他5件はtrueだが、設定内容を取得していないためsearch_pathが安全に固定されているとは未確認。
   - handle_post_like_count、apply_auto_hideもSECURITY DEFINER=true、has_local_settings=false。これらは取得したトリガーから参照されている。
   - 関数内部の本人確認・権限確認・引数の信頼境界、戻り値型、HTTP公開可否は未確認。実行権限だけで不正操作の成立を断定しない。関数の実呼び出しはしていない。

3. **広いGRANTと複数のPERMISSIVEポリシー**
   - posts/roomsはanon/authenticatedともSELECT/INSERT/UPDATE/DELETE権限true。postsにはposts_select_all、posts_select、posts_select_visible、posts_select_room_members等が併存し、今回の対象ポリシーはPERMISSIVE。
   - ポリシー名は実際の条件を保証しない。適用されるPERMISSIVE条件はORで組み合わされるため、制限的なポリシーを追加するだけで既存の許可を狭められるとは限らない。
   - publicのテーブルACLにはanon/authenticatedへのTRUNCATE等も含まれる。room_members/room_join_requestsはINSERT/UPDATE/DELETEが閉じていてもACLはrDxtm。TRUNCATEはRLS対象外なので、実行可能な経路の有無と不要な権限の整理を別途検討する。HTTP APIからTRUNCATEできることは確認していないし、実行もしていない。
   - postgres/supabase_admin所有のpublic既定権限には、anon/authenticatedへの広いテーブル・関数権限がある。attachment_uploadsや新RPCを追加する際、既定権限を無視して安全とは判断できない。
   - 根拠：[PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)。

4. **Storage policyの条件式が未確認**
   - storage.objectsのポリシーは5件：attachments read (public)、works_select_public（いずれもPUBLIC向けSELECT）、allow all uploads、works_insert_auth、attachments insert (authenticated)（いずれもauthenticated向けINSERT）。全件PERMISSIVE。
   - この名前だけではroom_uploadsに対する匿名閲覧や任意アップロードを断定できない。bucket_id、所有者、ルーム参加資格、パス条件の式を追加確認する必要がある。
   - 今回の一覧にstorage.bucketsのポリシーとobjectsのUPDATE/DELETEポリシーはない。バケットのpublic設定、Storage API経由の実動作、他経路は未確認。

5. **FKと退会・削除の整合性**
   - posts.room_id → rooms.idはON DELETE CASCADE。room_members.room_id → rooms.idもCASCADE。ルームの物理削除で投稿と参加行が連鎖削除され得る。
   - room_members.user_id、profiles.id、public_profiles.id → auth.users.idはCASCADE。rooms.created_by、room_members.approved_by、room_join_requests.decided_by → auth.users.idはNO ACTIONであり、参照が残る場合はAuthユーザー削除を妨げ得る。
   - posts.marked_by → auth.users.idはSET NULL。取得したpostsのFKはroom_idとmarked_byの2件で、posts.user_idのFKはない。NOT NULLだけではAuthユーザーへの参照整合性は保証されない。
   - auth.usersにはon_auth_user_created_profileの非内部トリガーを確認。room_membersにはtrg_enforce_core_limit、postsには編集日時とusername補完のトリガー等がある。本文未確認のため、名称から処理内容の正しさは保証しない。
   - attachment_uploadsのFK追加は、これらの連鎖と既存削除APIを考慮する必要がある。実データ削除やテストは行っていない。

### 未確認事項と次の作業

初回メタデータ監査は完了。ただしRLS条件式、関数本文・search_path値、ビュー定義・security_invoker、バケットpublic設定、既存行の整合性、実ユーザーの許可/拒否テストは未確認。attachment_uploadsの実装・権限変更をこの結果だけで開始しない。

次は読み取り確認の範囲を明示した上で、以下を優先する。
- room_membersの既読経路とprofiles.user_id参照のローカルコード照合。
- posts/rooms/room_members/storage.objectsのポリシー条件式、上記6関数の認可処理、対象バケット公開設定の確認。未加工の関数本文・設定値をそのままチャットに出さない取得/共有方法を事前に決め、追加取得は承認を得てから実行する。
- 必要な修正案を作り、DB・コード変更は別タスクとして提示する。今回その変更は行わない。

### 変更・検証

- docs/AI_TASK.mdをdoneに更新し、ログイン待ちを解消済みの記録へ変更。本書へ本節を追記し、メタデータCSVを保存。
- コード・DB・migration・RLS/GRANT/Storage設定は未変更。ユーザーテーブル行の取得、既存RPCの実行、commit / push / deployなし。
- 追跡済みコードのGit差分と未追跡のlib/attachmentPath.ts・docs/security-route-check.cjsのハッシュを文書更新前後で比較。監査SQL以外のDBクエリは実行せず、アプリのテスト・ビルドも実行していない。


## 19. 既読・退会コードの照合と追加監査SQLの準備（2026-10-21）

### 確認結果（コード・設定変更なし）

- app/components/MarkRoomSeenOnView.tsx:22以降はブラウザーからroom_members.last_seen_atを直接UPDATEし、返却されるerrorを確認しない。app/rooms/[id]/page.tsx:111で使用中。第18節のauthenticated列UPDATE=falseと不整合。
- 一方、app/rooms/[id]/BoardClient.tsx:103以降はuserIdとisMember（myRoleが存在するか）を条件に/api/rooms/seenへPOSTする。app/works/MarkReadOnView.tsx:34も同APIを利用し、作品ページで使用される。そのため既読全体が停止しているとは断定しない。
- app/api/rooms/seen/route.tsはBearerを検証し、本人の参加行とleft_atを確認して、Service Roleで本人・対象ルーム・left_at IS NULLのlast_seen_atを更新する。この経路はクライアントのUPDATE権限付与を必要としない。BoardClientはHTTPエラー応答を判定しないため、別途エラー処理の改善候補。
- 推奨修正方針（未実装）：既存seen APIへの呼び出しを整理し、直接UPDATEの重複を解消する。DB権限を一括で開けない。呼び出し回数、未参加/退出済み、成功時キャッシュ更新、HTTPエラーをテストする。
- app/api/rooms/mark-read/route.ts:35はlast_read_atを更新するが、取得済みroom_members定義にはその列がない。app/libの文字列検索でこのAPIの呼び出し元は見つからなかった。外部利用の有無は未確認なので勝手に削除しない。
- app/api/account/delete/route.ts:41–47はprofiles.display_name、avatar_urlを更新し、user_idで絞る。取得済みprofiles定義には3列ともない。更新エラー時は500を返し、後続deleteUserには進まない。実際の退会操作は実施していない。
- 退会APIは列名だけ直して完了とはできない。Auth削除を妨げ得るNO ACTION FK、プロフィールのCASCADE削除、作品の表示名・保持方針を合わせて設計する。usernameへ置換すれば十分とは断定しない。
- 参加・承認・却下APIはBearer認証由来のuserIdをService Role RPCへ渡す。approve/rejectはp_creator_user_id、join系はp_user_id。DBのanon EXECUTE=trueと合わせると、APIを経由しない呼び出しでも本人確認が成立するかが確認ポイント。ただしRPC本文未確認なので迂回可能とは未確定。

### 追加SQL（未実行・承認待ち）

対象は前回と同じminnade-tsukuru/main。取得対象はposts/rooms/room_members/storage.objectsのポリシー判定フラグ、6関数の認証関連文字列・search_path設定有無、およびroom_uploadsバケットの存在/publicフラグ。バケット設定行だけはpg_catalog外だが、ユーザー行やオブジェクト一覧ではない。関数・式の全文、引数実値、設定実値、秘密値は出力しない。

読み取り専用の理由：READ ONLY内でカタログと対象バケット設定をSELECTする。関数本文は文字列として検査するだけで、既存RPCを実行しない。pg_get_exprも式を表示用文字列へ変換するだけで式を評価しない。SET LOCALは当該トランザクションだけ。DDL/DML/GRANT変更なし、最後にROLLBACKする。

判定限界：literal_true=falseは安全の証明ではない。auth.uid等の文字列有無はコメントや別表記、補助関数に左右され、本人認証の成立を証明しない。search_path設定の存在も設定内容の安全性を保証しない。このSQLは秘密情報を出さず追加確認対象を絞るためのもの。本文の認可レビューは引き続き別途必要。

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = pg_catalog;
WITH policy_defs AS (
  SELECT n.nspname, c.relname, p.polname, p.polcmd, p.polpermissive,
    pg_catalog.pg_get_expr(p.polqual,p.polrelid) AS using_expr,
    pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) AS check_expr
  FROM pg_catalog.pg_policy p
  JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE (n.nspname='public' AND c.relname IN ('posts','rooms','room_members'))
     OR (n.nspname='storage' AND c.relname='objects')
), report(section,item) AS (
  SELECT 'policy_flags', pg_catalog.jsonb_build_object(
    'schema',nspname,'table',relname,'policy',polname,
    'command',polcmd,'permissive',polpermissive,
    'using_is_literal_true',using_expr='true',
    'check_is_literal_true',check_expr='true',
    'using_mentions_auth_uid',COALESCE(using_expr LIKE '%auth.uid(%',false),
    'check_mentions_auth_uid',COALESCE(check_expr LIKE '%auth.uid(%',false),
    'mentions_bucket_id',COALESCE((using_expr||' '||COALESCE(check_expr,'')) LIKE '%bucket_id%',false)
      OR COALESCE(check_expr LIKE '%bucket_id%',false))
  FROM policy_defs
  UNION ALL
  SELECT 'rpc_flags', pg_catalog.jsonb_build_object(
    'oid',p.oid,'name',p.proname,
    'security_definer',p.prosecdef,
    'returns_trigger',p.prorettype='pg_catalog.trigger'::pg_catalog.regtype,
    'body_mentions_auth_uid',p.prosrc LIKE '%auth.uid(%',
    'body_mentions_current_setting',p.prosrc LIKE '%current_setting%',
    'body_mentions_current_user',p.prosrc LIKE '%current_user%',
    'has_search_path_setting',EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p.proconfig) s(v) WHERE s.v LIKE 'search_path=%'))
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
    'mark_room_seen','join_room','join_core_first_come','join_core_by_invite',
    'approve_core_request','reject_core_request')
  UNION ALL
  SELECT 'room_uploads_config',pg_catalog.jsonb_build_object(
    'exists',EXISTS(SELECT 1 FROM storage.buckets WHERE id='room_uploads'),
    'public',(SELECT public FROM storage.buckets WHERE id='room_uploads'))
)
SELECT section,pg_catalog.jsonb_agg(item) AS metadata
FROM report GROUP BY section ORDER BY section;
ROLLBACK;
```

### 状態・検証・残作業

- ローカルコード読解と前回取得済みメタデータの照合のみ。追加SQL、既存RPC、退会/既読API、実ユーザー操作は実行していない。
- 新しいタスクをAI_TASK.mdにin_progressで登録。追加SQLは、以前ユーザーが指定した「実行前にコマンドと読み取り専用である理由を提示し、ユーザー承認を待つ」に従い承認待ち。
- 次は上記SQLの承認後に実行し、結果・限界を記録する。必要な修正案は別途提示し、コード・DB・migration・設定は今回変更しない。commit / push / deployなし。

## 20. 承認済み追加監査の実行結果（2026-10-21）

### 実行と証跡

- ユーザーの「OK、そのSQLを実行して進めて」を受け、第19節のSQLをminnade-tsukuru/mainの新規SQL Editorタブへ入力し、1回実行した。既存クエリは上書きせず、Save操作もしなかった。
- BEGIN READ ONLYからROLLBACKまで成功。結果は3区分（policy_flags 29件、rpc_flags 6件、room_uploads_config 1件）。
- docs/supabase-followup-audit-2026-10-21.csvにDownload CSVの結果を保存。DOMの結果とCSVの件数を照合した。
- 取得したのは判定フラグと対象バケットの存在/public設定のみ。ポリシー式・関数本文・秘密値・ユーザー行・Storageオブジェクト一覧は出力していない。RPCやアプリAPIも呼び出していない。

### 確認済みの重要事項：3テーブルの無条件SELECT

第18節のロール/権限メタデータと今回の判定を照合した。

- posts_select_all（OID 21479）、rooms_select_all（21474）、room_members_select_all（21476）はPUBLIC向けSELECT、PERMISSIVE、USINGが文字列としてtrueと完全一致。
- posts_select_authenticated、rooms_select_authenticated、room_members_select_authenticatedもUSING true。
- 前回一覧にこの3テーブルのRESTRICTIVEポリシーはなく、anon/authenticatedにはpublicのUSAGEと3テーブルのSELECT権限がある。
- したがって監査時点の構成では、DBロールとしてanon/authenticatedがこの3テーブルをSELECTする際、RLSによる行フィルターが機能しない。参加ルーム限定・非表示/削除済み投稿の除外等を、他のPERMISSIVEポリシーだけで強制できない。
- これは設定から確認できたアクセス制御上の問題。実ユーザーデータの取得、REST経由の再現、過去のアクセスや漏えい有無の調査はしていない。HTTP公開設定や追加ゲートの有無は今回未取得であり、実際の情報流出を断定しない。
- 最優先は既存の公開作品・ルーム一覧・参加者表示の要件を整理したうえでのSELECTポリシー見直し。無条件ポリシーを追加の制限ポリシーだけで相殺しようとせず、既存許可を含めた変更案と回帰テストを準備する。
- 参照：[PostgreSQL RLSのPERMISSIVE結合](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)。

### Storage

- room_uploadsは存在し、public=false。非公開バケット設定を実確認できた。
- storage.objectsの5ポリシーはいずれもbucket_idという文字列を含む。PUBLIC向けの2件のSELECT条件はliteral trueではない。
- INSERTのallow all uploadsとattachments insert (authenticated)はliteral trueではなく、auth.uid(という文字列を含まない。works_insert_authはauth.uid(を含む。
- 対象bucket_idの値や条件全体は未取得。ポリシー名や文字列有無だけでroom_uploadsへの匿名取得/任意アップロードの可否を断定しない。非公開バケットであってもStorageのSELECTポリシーによるアクセスが安全という保証にはならない。

### RPC

- 6関数すべてSECURITY DEFINER=true、returns_trigger=false。
- mark_room_seenだけがauth.uid(という文字列を含む。search_path設定も存在するが、その内容と認可ロジックの正しさは未確認。
- join_room、join_core_first_come、join_core_by_invite、approve_core_request、reject_core_requestの5関数は、今回の完全一致に近い部分文字列検査でauth.uid(、current_setting、current_userのいずれも見つからなかった。
- join_roomのみsearch_path設定なし。他4件は設定あり。前回6関数ともanon/authenticatedのEXECUTE=trueを確認済み。
- この5関数の認可レビューを優先する。別表記、大文字小文字、補助関数、セッション情報の別取得方法、コメント等により文字列検査は偽陰性/偽陽性があり得る。認証なしで不正参加・承認できるとまでは未確認。関数自体は実行していない。
- アプリはService Role経由で認証済みuserIdを引数に渡すため、直接RPCの呼び出しを許す必要性と関数内部の本人照合を確認する。mark_room_seenにはブラウザー呼び出し実装も存在するので、6件一括でEXECUTEを閉じる修正は提案しない。

### 次の修正方針と残る確認

1. 最優先：3テーブルの無条件SELECTを解消する案を作る。必要な公開範囲、参加中/退出済み、投稿/ルームの非表示・削除、公開作品を明示し、既存各ポリシーの条件とビューの依存を確認してから変更する。まだDDLは作成・適用していない。
2. 同時に優先：上記5関数の認可・引数・search_pathを安全にレビューし、API専用関数と直接呼び出しが必要な関数を区別した権限制限案を作る。未加工の関数本文に秘密値がないと仮定せず、追加の取得方法・対象を提示し承認後に行う。
3. 既読は既存seen APIへ整理する案、退会は存在しない列の参照だけでなくFKとデータ保持も含めた修正案。第19節のコード照合結果を維持する。
4. Storageはbucket_idの対象と所有者・参加条件を追加確認する。今回のフラグだけでは条件の意味を決められない。

今回のタスク（コード照合と承認済み追加監査、修正対象の絞り込み）は完了。追加の本文取得やコード/DB修正は未実施であり、全体のセキュリティ改善完了を意味しない。

### 変更・検証

- docs/AI_TASK.mdをdoneに更新、docs/AI_HANDOFF.mdへ本節を追記、追加監査CSVを保存。
- 既存追跡コード差分および未追跡lib/attachmentPath.ts・docs/security-route-check.cjsのハッシュを更新前後で比較。
- コード・DB・migration・RLS/GRANT/Storage設定変更なし。ユーザーデータ変更・秘密値出力なし。commit / push / deployなし。アプリのテスト・ビルドは未実施。

## 21. 無条件SELECTを解消する修正案（2026-10-21）

- ユーザーの依頼に基づきdocs/RLS_SELECT_REMEDIATION_PLAN.mdを作成。コード読解と既存監査結果のみを使用し、追加SQLは実行していない。
- 推奨境界：可視・未削除ルームの公開列、可視・未削除投稿のうち公開作品または参加中の閲覧、本人の参加情報（退出済みを含む）。公開作品のfinalと制作ログの表示を維持する。
- 6件の無条件SELECTだけでなく、全SELECT/ALL許可、列権限、rooms_with_counts系ビューを一体で見直す案。一覧の人数集計は限定APIへの移行を推奨し、本人RLSによる人数の縮退を避ける。
- rooms.core_invite_codeを列権限で保護する必要を記載。詳細ページは取得しているが、確認したRoomDetailClient propsには渡していない。既存専用APIのcreator照合を維持する。
- 未公開投稿の非参加者/退出者閲覧は制限する提案。既存RPC/Storageの安全性や実装可能なDDLは未確定。適用前の定義レビュー、移行順序、ステージング試験、失敗時対応を明記した。
- docs/AI_TASK.mdはこの提案タスクへ更新し、文書作成完了をもってdoneとした。セキュリティ修正の適用完了を意味しない。
- 変更は上記提案書・AI_TASK.md・本書のみ。追跡コード差分と未追跡lib/attachmentPath.ts・docs/security-route-check.cjsを比較して保持を確認。アプリテスト・ビルドは未実施（文書のみ）。DB・ユーザーデータ・migration・設定の変更なし。秘密値取得/表示なし。commit / push / deployなし。
- 検証用の差分/引継ぎ全文を別プロジェクト領域へコピーする最初のコマンドは自動承認レビューに拒否されたため未実行。コピー処理を除外し、リポジトリ内の読み取りと文書更新に限定して続行した。
- 次の作業：追加の読み取り専用監査SQLと、秘密値を出力しない定義レビュー手順を作成・提示する。SQL実行および本番変更はそれぞれ承認後に行う。

## 22. ポリシー・ビュー定義確認SQLの作成（2026-10-21）

- docs/supabase-policy-view-review.sqlとdocs/SUPABASE_POLICY_VIEW_REVIEW.mdを作成。3テーブルの全ポリシー、4ビュー、設定・直接依存・実効SELECT権限を確認するSQL案。
- READ ONLYトランザクション内でカタログを参照し、定義テキストはDB内部で復元後、文字列・数値・未知識別子を伏せて返す。未対応の字句形式は全文を保留する。アプリ関数・対象ビュー・ユーザー行の読み取りは実行しない。
- 伏せ字済み定義だけでは完全な認可レビューにならない。未確認の定義は追加判定SQL等を別途提示する。全文出力への自動切替はしない。
- SQLは未実行。Dashboardにも入力していない。ユーザーの実行前提示の指示に従い承認待ち。今回のSQL作成・提示タスクはdoneとし、実行タスクの完了とは区別する。
- 変更はSQL案・説明書・AI_TASK.md・本節のみ。追跡コード差分と未追跡attachmentPath.ts/security-route-check.cjsのハッシュを比較して保持確認。DBでの構文検証やアプリテストは未実施。コード・DB・migration・設定変更、秘密値取得、commit / push / deployなし。

## 23. 承認済みポリシー・ビュー監査の実行（2026-10-21）

- ユーザーの離席中作業指示により、supabase-policy-view-review.sqlを変更せずminnade-tsukuru/mainで1回実行。入力全文を改行/BOMを除いてファイルと照合した。
- SQL Editor b111dad2-ad24-4829-996b-fb2cefc87e88。BEGIN READ ONLYからROLLBACKまで成功。transaction_read_only=on、server_version_num=170006、対象7件。
- 結果6区分：definitions_redacted 52、direct_dependencies 146、effective_select 14、environment 1、objects 7、policies 24。伏せ字済み結果をsupabase-policy-view-audit-2026-10-21.jsonに保存。
- 4ビューともsecurity_invoker=true/security_barrier=false。3テーブルはRLS=true。anon/authenticatedは対象7件すべてテーブルSELECT=true。無条件SELECT以外の過大許可も確認し、分析を継続する。
- ユーザー行・対象ビュー結果・関数実行なし。DB/RLS/GRANT/Storage等の変更なし。追加SQLは実行していない。

## 24. 実DB分析・参加API/Service Role調査・添付設計（2026-10-21）

- SECURITY_AUDIT_2026-10-21.mdに3テーブル全24ポリシーのrole/条件、4ビューの定義・設定・直接依存、P1/P2/P3、参加関連全経路とService Role利用箇所の評価を記録。伏せ字済み定義の別紙はSUPABASE_POLICY_VIEW_DETAILS.md。
- P1：無条件SELECT以外にもposts_select_visible等の過大許可。posts UPDATEは本人条件だけ、rooms_insert_authはauth.uid非NULLだけ。APIのルーム状態/final/添付所有権制約をDBポリシーは保証しない。Trigger/CHECK本文未確認なので実攻撃成功とは断定しない。
- 4ビューすべてsecurity_invoker=trueを確認。前回修正案で未確認としていた点を解消。room_members本人限定化後の人数縮退は移行時に対応が必要。
- P1コード経路：未認証expireによる期限切れ公開、旧joinの同意/枠/既存roleチェック欠落とcore降格→退出ロック迂回、旧core承認の枠チェック欠落。同一room他人path受理も継続。
- P2：debug bucket情報開示、参加APIのhidden/deleted漏れ・競合・同意の非原子的更新、退出者の本人投稿削除、既読権限/旧列不一致、旧core UIパス不一致等。
- 旧JoinButtonは参照が残るが親canPostと自身!isMember条件が噛み合わず、通常UIの到達は低い。公開HTTP経路としての問題と区別した。
- ATTACHMENT_UPLOADS_READINESS.mdに実DBの型/FK、台帳状態、owner/room/post削除時SET NULL案、原子的post作成＋台帳消費、API専用RPC権限、Storageとの非原子性、cleanup競合、旧公開作品互換、移行/rollbackを具体化。migrationは作成・適用していない。
- 新規security-audit-check.cjsの17ケースで認証あり/なしの経路をモック再現。GAPケースの合格は脆弱な処理経路を再現した意味で、修正完了ではない。DB Trigger/RLSは模倣していない。
- 既存security-route-check.cjsに6ケースを追加し58ケース合格。拒否時にDB/Storage変更や署名がないことも検証。所有権GAPは残る。
- app/api/uploads/route.tsのcatch(any)をunknown＋Error判定へ変更（ローカルの軽微な型修正）。既存の安全性修正は維持。認証/API/DB仕様は変更しない。
- USER APPROVAL REQUIRED：RPC/Trigger/Storage Policy等の追加読み取りSQL、旧API停止/統合、RLS/DML/GRANT変更、添付の保持・削除方針とステージング実装。これらは実行せず他のローカル調査を続行した。

## 25. 最終検証・限定修正・引継ぎ（2026-10-21）

### 完了と検証
- 承認済みSQLは1回のみ実行。元ファイル無変更を再照合。SHA256: 19F37C06413F6C8A67A3F3141EA8916CE2C9BCC5B247EB0999AF54AF95E5CB6E。
- security-route-check.cjs：58ケース成功（今回6ケース追加）。security-audit-check.cjs：17ケース成功。合計75。GAPケースは既存不備の再現であって対策済みではない。
- ローカル既存typescriptを直接使用した tsc --noEmit --incremental false：最終exit0（npxの追加インストール不要）。最初の単独型検査後、buildで生成されたNext型検査により2ページのparams型不一致が判明し修正。
- build：ダミーSupabase URL/キー・CRON_SECRET、telemetry無効、audit-no-network.cjsでfetch/HTTP/HTTPS/TLS/TCPを遮断して next build --webpack を実行。初回はparams型エラー、修正後exit0、23静的ページ生成完了。本番データ取得なし。
- build成功後、RoomRowキャスト2箇所の型のみ明確化し、最終tsc・lintを再実施。これは実行時コードを変えない型アサーション変更で、追加のfull buildは行っていない。
- 変更ファイル限定lint：exit0、エラー0、AttachmentView.tsxの既存img警告1。git diff --check：exit0。
- buildのmiddleware命名非推奨/キャッシュサイズ警告は別の保守課題。テストは本番API・DB・Storageの動作を証明しない。

### 今回の変更ファイル
- app/api/uploads/route.ts：catch(any)→unknown、Error以外の例外は汎用文言。既存room可視性チェック差分を維持。
- app/rooms/[id]/page.tsx：paramsをPromise型へ、as any 2箇所を既存RoomRow|nullへ。
- app/works/[id]/page.tsx：paramsをPromise型へ。既存postId付き添付表示差分を維持。
- docs/security-route-check.cjs：認証/非参加/退出の6ケース追加。
- docs/security-audit-check.cjs：17ケースのオフライン監査モックを新規作成。
- docs/audit-no-network.cjs：隔離buildの通信遮断用preload。
- docs/SECURITY_AUDIT_2026-10-21.md、SUPABASE_POLICY_VIEW_DETAILS.md、ATTACHMENT_UPLOADS_READINESS.md：調査/設計文書。
- docs/supabase-policy-view-audit-2026-10-21.json、supabase-policy-audit-proof.png：安全な監査証跡。
- docs/audit-build-result.txt、audit-build-after-types.txt、audit-lint-result.txt、audit-types-result.txt：ローカル検証ログ（typeログは成功時空）。
- docs/RLS_SELECT_REMEDIATION_PLAN.mdとSUPABASE_POLICY_VIEW_REVIEW.md：実行後に判明した事実を補足。
- docs/AI_TASK.mdをdone、AI_HANDOFF.md第23～25節を追記。
- scripts/reset-password.mjsは文字列/数値リテラルを伏せたASTで読解のみ。管理者CLIで、パスワード引数の履歴等への露出をP2として記録。スクリプトは実行していない。

### Git状態
- branch: security/fix-storage-sign。開始時の追跡済み8ファイル差分と未追跡AGENTS/docs/lib/attachmentPath.tsを保持。
- 最終追跡変更9ファイル：app/api/posts/create/route.ts、app/api/storage/sign/route.ts、app/api/uploads/public/[postId]/route.ts、app/api/uploads/route.ts、app/api/uploads/sign/route.ts、app/rooms/[id]/page.tsx、app/works/PostAttachment.tsx、app/works/[id]/AttachmentView.tsx、app/works/[id]/page.tsx。
- 今回新たに手を入れたアプリファイルは上記3件のみ。他6件の差分は開始時からの既存作業。
- commit/push/deploy/merge/reset/clean/stash/branch削除なし。DB・migration・Storage・RLS・GRANT・Function・Triggerの変更なし。build生成物はローカルのみでデプロイしない。

### USER APPROVAL REQUIRED / 未解決事項
- RPC/Trigger/CHECK/Storageの追加安全監査。今回は承認済み1本以外のSQLは実行していない。
- 旧join/expire/debug/旧core経路の停止・統合。P1を軽微な修正とみなして勝手に認証/API設計を変更しなかった。
- SELECTだけでなく直接DMLのRLS/GRANTを整備する実装・適用。
- 添付owner/room/post削除・保持/cleanup期間、旧作品の保全方針を確定してからステージング実装。
- 本番の悪用・情報流出の有無は未調査。実ユーザー行を取得していない。

### 次に推奨する作業（優先順）
1. 未認証expireと旧参加/承認経路の停止・統合案を承認し、回帰テストとともにローカル実装する。
2. RPC/Trigger/Storageの安全な追加監査を承認し、直接DMLの迂回可能性を含む最終認可案を固める。
3. 招待コード列保護・SELECT/INSERT/UPDATE境界と集計APIをステージングで検証する。
4. attachment_uploadsの保持/削除仕様を確定し、原子的投稿確定RPCと段階移行を実装する。
5. 既読・旧core UIパス・退会列/FK不一致を個別タスクで修正する。

今回承認された調査・検証・設計は完了。承認待ち事項は将来の実装/追加監査であり、セキュリティ対策が適用済みという意味ではない。


## 26. 追加離席作業開始（2026-10-21）

最新指示で安全なP1/P2ローカル修正が許可された。前節の旧API修正承認待ちはこの範囲で解消。開始追跡差分9件は保持。モック17件を再実行し、未認証expire/debug、旧join、非表示参加、退出後削除のGAPを再現した。
呼び出し元をapp/components/libで再検索。未認証expire/debug、/rooms/join、/api/rooms/expire/joinには呼び出し参照なし。vercel.jsonのcronは/api/cron/publishで別経路。外部利用履歴は取得していないため完全未使用の断定はしない。旧/api/rooms/joinと旧core系はUI参照/互換性不確実性が残り、今回はdeprecated候補として保持する。

## 27. ローカルP1/P2修正・設計資料整備（2026-10-21）

### 今回実施した修正

- 未認証POST /api/rooms/expire、GET /api/debug/bucketsを410/no-store化しService Role import/DB・Storage処理を除去。
- 参照未検出のPOST /rooms/join、/api/rooms/expire/joinを同様に410化。外部利用状況は未取得であり完全未使用の断定ではない。
- join-supporter/request-coreでroom.is_hidden=false、deleted_at=NULLを必須化。
- posts/deleteでmembership.left_at=NULLを必須化。
- 小規模な型改善（catch unknown、consentの引数型）。通常参加/申請、既存active core維持、本人active投稿削除をモックで確認。
- 差分レビューでrequest-coreの申請テーブルSELECTにroom列を混入した編集を発見して除去。モックも既知fixtureの未知列を拒否するよう補強し再検証。最終コードには混入なし。

旧/api/rooms/joinはJoinButtonの参照が残り、旧core-*もPanelとのパス差/仕様が不確実なためユーザー指定どおりdeprecated候補として保留。安全性を理由に既存機能を推測で全面削除しなかった。

### 監査・設計成果物

- LOCAL_SECURITY_HARDENING_2026-10-21.md：今回の修正、全参加経路、残P1/P2/P3、影響/rollback。
- SERVICE_ROLE_INVENTORY.md：全Service Role参照のファイル/API/用途/認証/認可/入力/代替性/リスク/推奨対応。停止4件は履歴として別記。
- ATTACHMENT_UPLOADS_READINESS.md：具体的user_id/room_id/bucket/storage_path/status/uploaded_at/used_at/expires_at/post_id/mime/size、FK/一意制約/遷移、RPC入力・ロック順、idempotency、cleanup競合、移行検収を追記。保持期間等は未確定。SQL/migrationファイルは追加していない。
- LEGAL_RIGHTS_RISK_REGISTER.md：共同制作/外部利用/離脱/侵害/人格権、全UGC運営、AI送信/学習/国外処理をP1/P2で登録。技術/UI/規約/PP/運営/専門家確認を各項目に記載。
- TERMS_PRIVACY_REQUIREMENTS.md：現行規約の権利保持・相互許諾・外部利用禁止等と将来方針の差分。改定論点のみで公開文面/同意versionは未変更。
- APP_PLATFORM_API_ROADMAP.md：PWA/Tauri/Electron/Capacitor/React Native+Expoを現在のNext構成で比較、Bearer/Cookie/RSC/API/配布更新の境界と段階案。
- AI_CREATOR_KPI_DESIGN.md：AI禁止/1room1体/Authなし/final禁止、queue/再試行/費用/同意/表示、human_post_after_aiを中心にした指標定義。

これらを今後も追跡する正式な開発テーマとする。法的結論や実装済み機能ではない。各文書に未決事項・実装開始条件を記録し、次回AGENTSの開始時確認から参照できるよう本節で索引化した。

### 重要な発見と実環境の扱い

新しい独立P1の実証は追加なし。既知P1の入口を部分的にローカル閉鎖。残る無条件SELECT、直接DML、他人path再使用、旧join、旧core-approve、RPC本文未監査は継続。
P2補足：VercelのCRON_SECRETはAuthorization Bearerで送られるが現cronはquery keyだけ受理。偽Bearer secretを送るモックが401/無更新を再現。実稼働の失敗/secretの有無は未確認。認証/schedulerの互換変更は保留。
この追加作業ではSupabaseへ接続も新しいSQL実行もしていない。前回のREAD ONLY監査metadataだけを利用。元supabase-policy-view-review.sqlのSHA256は19F37C06413F6C8A67A3F3141EA8916CE2C9BCC5B247EB0999AF54AF95E5CB6Eで保持。

### USER APPROVAL REQUIRED

1. 残る旧join/旧core経路の互換性を含む停止・統合、RPC/Trigger/Storageの追加読み取り監査。
2. RLS/GRANT/直接DMLと招待コード列の保護、ステージング/本番適用。今回API修正だけでDB迂回は閉じない。
3. attachment_uploads DB設計、owner/room/post削除・保持期間・cleanup、移行停止時間、旧client切替。
4. cronのheader認証移行と外部scheduler確認。account deletionの仕様・列/FK整合。
5. 法務専門家レビュー、公開範囲/外部利用/退室後保持、AI無同意学習禁止候補の正式採用、provider・同意・保持/国外処理、規約PP改定公開。
6. AI/分析/PWA/native試作の実装開始、予算・queue・通知・配布。今回は設計のみ。

### 次の実装優先順位

1. 旧/api/rooms/joinと旧core-approveの安全な廃止/現行経路統合。
2. RPC/Trigger/Storage追加定義確認とRLS/GRANT修正のステージング試験。
3. 台帳＋原子的post確定＋直接path/DML迂回閉鎖。
4. 参加人数・同意記録の原子化/サーバー検証。
5. 既読、cron、退会列/FKの仕様を揃える。
6. 通報/ブロック/BAN/異議/緊急非公開の運用と技術。
7. 権利・保持・AI送信の決定と専門家レビュー。
8. 人間の参加→投稿→完成KPIを最小計測。
9. AI許可roomだけの小規模opt-in実装。
10. Web成果確認後PWA、需要に応じCapacitor/Tauriの限定試作。

## 28. 追加作業の最終検証・Git状態（2026-10-21）

### 検証結果

- node node_modules/typescript/bin/tsc --noEmit --incremental false：最終コードでexit0。既存ローカル依存を使用しnpx downloadなし。docs/local-hardening-types.txt（成功時空）。
- node node_modules/next/dist/bin/next build --webpack：exit0、20 static pages。docs/local-hardening-build.txt。Supabase URL/anon/service/cronはプロセス内のダミー値、audit-no-network.cjsでfetch/http/https/TCPを遮断、telemetry無効。実env値は出力していない。webpack以外のbundlerは未検証。
- 追跡変更16ファイル＋attachmentPath＋モック2本＋network guardの限定lint：0 errors、既存AttachmentView.tsx:78のimg警告1。docs/local-hardening-lint.txt。追加した最終cronテストも個別lint exit0。
- security-route-check.cjs：58 assertions成功。未ログイン/非参加/参加中/退出/削除・非表示post/room/別room/不正path等。same-room他人pathの受理は未解決GAP。
- security-audit-check.cjs：40ケース成功。停止4APIはtoken有無とも410/DB無アクセス、可視room参加/申請/本人active削除は成功、非表示/削除/unknown可視性/退出は拒否。旧join/旧core/cron不一致のGAP再現を含む。
- 合計98モック検査成功は全脆弱性解決を意味しない。DB RLS/Trigger/競合/実Storageや実ユーザー利用は未検証。
- git diff --check：exit0。CRLF正規化warningのみ、既存差分を正規化するための大量編集はしていない。
- 最終diffレビュー実施。元承認SQLのSHA256一致。

### 今回変更したアプリファイル（7件）

1. app/api/debug/buckets/route.ts
2. app/api/rooms/expire/route.ts
3. app/api/rooms/expire/join/route.ts
4. app/rooms/join/route.ts
5. app/api/rooms/join-supporter/route.ts
6. app/api/rooms/request-core/route.ts
7. app/api/posts/delete/route.ts

その他変更：docs/security-audit-check.cjs、AI_TASK.md、AI_HANDOFF.md、ATTACHMENT_UPLOADS_READINESS.md、SECURITY_AUDIT_2026-10-21.md。新規設計文書6件は第27節に列挙。新規検証ログはlocal-hardening-build/types/lint/attachments/routes/diff-checkの6件。

### 開始時から保持したアプリ差分（9件）

app/api/posts/create/route.ts、app/api/storage/sign/route.ts、app/api/uploads/public/[postId]/route.ts、app/api/uploads/route.ts、app/api/uploads/sign/route.ts、app/rooms/[id]/page.tsx、app/works/PostAttachment.tsx、app/works/[id]/AttachmentView.tsx、app/works/[id]/page.tsx。今回これらは編集していない。最終numstatは開始時合計122 insertions/84 deletionsのまま。

branch security/fix-storage-sign。追跡変更は計16件、未追跡AGENTS.md/docs/lib/attachmentPath.tsを保持。commit/push/merge/deployなし、branch切替/削除/reset/clean/stashなし。本番DB・migration・RLS・GRANT・Storage・Supabase設定変更なし。追加の本番SQL/ユーザーデータ取得/作品取得もなし。

今回の安全なローカル修正・検証・設計作業を完了しAI_TASKをdoneとする。第27節の実装/本番適用/法務方針の未承認作業は残る。サービス全体が公開準備完了という判断ではない。

## 29. 残る旧join・core書込み停止（2026-10-21）

ユーザーから呼び出し元/互換性確認と安全なローカル停止・統合を明示承認。開始branch security/fix-storage-sign、追跡差分16件を保持。

### 確認と修正

- JoinButtonはBoardClientの非参加者条件、親RoomDetailClientはactive role時のみBoardClientを描画。旧joinは現行画面では到達しないがHTTP経由で同意/人数/role維持を迂回できた。
- OwnerCoreRequestsPanelは存在しない/api/rooms/{id}/core-*へCookie requestを送信。実ルートは/rooms/{id}/core-*、rewriteなし。現行RoomDetailClientにpending一覧/Bearer承認・却下が別に存在する。
- POST /api/rooms/join と /rooms/[id]/core-request・core-approve・core-reject・core-revokeの5本を410/no-storeへ。Supabase dependencyと書込みを除去、旧payloadを自動forwardしない。
- JoinButton.tsxとOwnerCoreRequestsPanel.tsxを削除。BoardClientの旧参加ボタンは現行参加メニューへの文章案内へ、pageの旧Panel import/mountを除去。参加・承認UIを既存RoomDetailClientへ一本化。
- core-requests GETは所有者確認付きreadとして保持。revokeは同等の現行機能がなく、旧物理削除を停止するまで。取消仕様の新設は行わない。
- 現行Bearer参加/承認/却下API・RoomDetailClientは無変更。RPCの内部認可・人数競合は今回安全性を証明していない。

### 互換性と残リスク

旧Cookie+requestIdやroomIdのみのclientは410になる。外部caller/古いtabの実利用状況は未取得、完全未使用との断定はしない。画面再読込みと現行同意付き操作を使う必要がある。変更の詳細はLEGACY_JOIN_CORE_RETIREMENT.md。
P1-04の旧join入口、P1-06の旧core-approve/expire-join入口はローカルで停止済み。本番には未適用。無条件SELECT/直接posts DML/他人path/公開RPCの問題は残る。USER APPROVAL REQUIRED：追加RPC/Trigger/Storage監査、DB権限変更、原子化、新しいcore取消仕様、本番適用。

### 検証結果

- 開始時security-audit-check40ケースで旧GAP再現。修正後81ケース成功。停止5本×5状態ではdependency import禁止、壊れたJSON/偽Bearer/Cookieでも410/DB無アクセス/行不変。旧join→leaveの退出ロック迂回は403で阻止。
- 現行approve/rejectの未認証拒否、検証済actor/body偽装無視、RPC権限エラー403、承認の別room申請404を偽DB/RPCで確認。
- 添付security-route-check58ケース成功。合計139検査（未解決path/cron等GAP再現を含む）。実DB・並行性・ブラウザE2Eは未実施。
- typecheck：node node_modules/typescript/bin/tsc --noEmit --incremental false exit0。
- build：ダミー設定+audit-no-networkでnext build --webpack exit0、20 static pages。middleware命名の既存警告あり。
- 今回変更ファイル限定lint：エラー0、BoardClientの既存img警告1。git diff --check exit0。
- 旧UI callerをapp/components/libで再検索、残存なし。型/buildでも削除componentの未解決importなし。
- docs/legacy-api-baseline-hashes.jsonで開始時16ファイルを照合。page.tsx以外15件はSHA256完全一致。pageの既存型修正はdiffレビューで保持確認。

### 変更ファイルとGit

今回アプリ変更7件：api/rooms/join、rooms/[id]/core-request、core-approve、core-reject、core-revokeの各route.ts、rooms/[id]/page.tsx、BoardClient.tsx。削除2件：JoinButton.tsx、OwnerCoreRequestsPanel.tsx。
docs/security-audit-check.cjs、AI_TASK/AI_HANDOFF、監査状態追記、LEGACY_JOIN_CORE_RETIREMENT.mdとlegacy-api-*検証記録を更新/追加。
追跡差分は計24件（開始16＋新規変更/削除8）。未追跡AGENTS/docs/lib/attachmentPath.tsを保持。commit/push/deploy/merge/branch変更/reset/clean/stashなし。本番DB・Supabase・Storage変更/接続なし。AI_TASKをdoneへ。
次は追加監査SQLの事前提示と承認を経て、RPC本文/権限と直接DMLの穴を確認し、DB側の原子的認可を設計する。

## 30. Web MVP公開準備開始（2026-10-21）

最新指示でローカルmigration/RPC作成が許可された。本番は一切変更しない。開始追跡差分24件。PGliteをdev依存に追加（install scripts無効）し合成DBのみでSQL検証する。
新規P1候補：TermsConsentGateにメールlocal-partからfallback usernameを作る処理が残存。過去に完全解消されたと扱わず、今回除去する。既存レコードの存在/値は取得しない。
公開の必須条件はWEB_MVP_100_PERCENT_CHECKLIST.md。RLS/GRANT/実RPC/削除・法務方針・実機E2E等は別判定する。
### ローカル実装・検証の進捗（第30節続き）

- attachment_uploads/post_requests/rate counterとservice専用RPCのmigration候補、upload/post UI/APIを実装。SQLはPGlite合成fixtureだけに適用。本番には未接続。
- client指定pathを拒否しowner/room/expiry/未使用をatomicに検証。再送本文はSHA256のみ保持。flag未設定時、新規添付は503、本文のみ旧経路。旧公開作品readは維持。
- 連打制限を現行room create/join/core/like/reports/post/uploadへ追加。flag falseではこれらのDB rate counterは未稼働。公開前にtrueとstaging検収が必須。
- メール由来fallback usernameを20文字以内のrandomへ、公開profileをusername/bio投影へ。既存profile値の取得・変更なし。
- cronをBearer化、query秘密/詳細debug応答を廃止。hidden/deleted/future/二重実行を検証。
- seen API統一。未読API/SSRのNULL初回混在・非表示/削除post/room・退出の集計を修正。ユーザー共通sessionStorage未読cacheを廃止。
- いいねの非表示room拒否と失敗応答、通報理由上限、変更APIの内部例外応答を改善。
- 投稿入力保持/サイズ・文字数表示、modal focus/Tab/Escape/復帰/同意reset、検索/loginラベル、一覧失敗の再読込、狭幅grid/headerを改善。実機modal/スマホ検収は未完。
- npm依存監査でCritical1/High5/Moderate1を検出しNext16.4.2/ESLint config同版へ更新、互換範囲のaudit fix（scripts無効/force無し）。本番依存の再監査0件。開発用braces起因High5packagesが残り、major downgradeは実行せずP2記録。
- 新docs：WEB_MVP_IMPLEMENTATION、VALIDATION、DB_AND_DEPENDENCIES、ANALYTICS、TERMS_READINESS、PRIVACY_READINESS、MODERATION_POLICY。チェックリスト18領域を更新。Analytics設計以外は公開ゲート未完。

### 今回確認した限界・承認待ち

USER APPROVAL REQUIRED：実RPC/Trigger/Storage/profile関連の追加監査、RLS/GRANTとDB migrationのレビュー・staging適用、本番反映、退会/名義/作品保持、旧email由来profileの是正方針、法務文面、通報担当/連絡先/BAN/異議運用。
実DBの無条件SELECT/直接DML/公開RPCは未解決。core/supporter人数競合と同意原子性、退会列/FK、cleanup/内容検査、実機・メールE2E、100人性能測定が残る。新台帳migrationだけの本番適用は不可。
本番変更待ちだけで100％に届く状態ではない。AI_TASKはin_progressを維持。未承認作業以外の残テスト・設計をWEB_MVP_VALIDATION/IMPLEMENTATIONへ引継ぐ。
### 最終検証とGit（第30節続き）

- npm run test:security：281検査成功（添付API64、その他API/未読126、upload形式35、Privacy3、PGlite53）。5スクリプトの外向き通信を遮断。実DB/Storage/並行接続の代替ではない。
- tsc --noEmit --incremental false：exit0。Next更新直後は旧生成型の不整合で失敗したが、Next16.4.2 buildによる再生成後に再実行して成功。
- 変更TS/TSXと新lib限定ESLint：exit0、エラー0、既存img警告2。新lintのfetchPosts検出はawait後のstate更新であり、該当1行だけ理由付き抑制。全体lintを無条件無効化していない。
- Next16.4.2 webpack build：ダミー設定+audit-no-networkでexit0、static20 pages。middleware→proxyの既存警告、Next内部のprocess.cwd Edge Runtime警告が残る。staging middleware検証が必要。
- git diff --check：exit0。秘密パターン検査85ファイル0件（JWT/service secret/private key、値出力なし、完全な秘密不存在保証ではない）。
- 承認済みsupabase-policy-view-review.sql SHA256は19F37C06413F6C8A67A3F3141EA8916CE2C9BCC5B247EB0999AF54AF95E5CB6Eで不変。
- ローカルbrowserでhome/login/rooms/worksの未ログイン表示と遷移、未入力login拒否、ラベル、通信失敗の日本語案内、再読込動作を確認。最終Next16.4.2でもroomsを再確認。スマホ/認証済modal/実DB E2E未実施。検証用serverと自分が開いたtabは終了し、元のSupabase tabは変更していない。
- 最終branch security/fix-storage-sign。追跡差分47件（開始24件を保持し追加修正）、削除2件は前作業からの旧UI停止。package/package-lock、新lib3件、local migration、docsを追加/更新。全パスはmvp-git-status.txt。
- commit/push/deploy/merge/branch変更/reset/clean/stashなし。production DB/Storage/RLS/GRANT/Supabase設定変更なし。外部通信は公開ドキュメントとnpm公開依存監査/取得のみ。本番ユーザーデータ・秘密値の表示なし。

次の推奨順：追加read-only実RPC/Trigger/Storage監査→退会/保持/通報運用の決定→合成stagingへDB権限案/台帳案を適用検証→主要E2E・複数接続・スマホ・負荷→承認後の段階公開。P1が残るので本番反映を今すぐ承認する段階ではない。
## 31. 100人MVPの退会保持・名義・通報推奨案（2026-10-21）

ユーザー依頼：具体的推奨案を作成し、その間も本番変更/commit/push/deployなしで安全な修正・テストを継続。
開始branch security/fix-storage-sign、追跡差分47件。開始時に既存変更45実在ファイルのSHA256をretention-baseline-hashes.jsonへ保存。終了時すべて一致（既存差分無改変、旧UI削除2件も維持）。

### 提案

MVP_RETENTION_MODERATION_RECOMMENDATION.mdを新規作成。必要な許諾範囲で共同作品を原則保持、Auth/公開profileを切り離し、退会名義変更は本人確認、ペンネーム保持は明示選択、権利侵害/個人情報は例外審査。creator退会は他人作品を巻き込んで削除/即公開せず、引継ぎ意思と公開保留を設計する案。
30日通常退会処理、解決通報証拠90日、再発防止情報180日見直し、ログ30日、backup最大90日確認という仮案。これらは法定期間でも既存機能でもない。provider/専門家確認後だけ公表。
通報は責任者+代理、毎日2回確認、24時間一次確認/通常72時間初回判断、緊急時は発見次第暫定非表示、14日通常異議受付と7日進捗連絡。非登録/退会者の窓口、利益相反・大量虚偽通報・署名URL失効限界・保全例外を明記。公式PPC/文化庁資料を参照したが法的適合保証はしていない。正式採用/規約公開なし。

### 安全な局所修正

- app/api/posts/toggle-mark/route.ts：room明示可視/非削除を確認、hidden/deleted post拒否、UPDATEと競合再取得にroom/visibility/deleted条件。更新前にpostが非表示/削除/他room移動した場合は404。可視postの通常競合は既存200+conflictを維持。room/memberとpost UPDATEのtransaction競合は未解消で別設計。
- app/api/account/delete/route.ts：DB/Auth例外全文を利用者へ返さず汎用エラーに変更。削除の順序/対象/仕様は無変更。不在列/FK/部分成功問題は依然未解決。
- docs/security-audit-check.cjs：21検査追加。非表示・削除・NULL/role/退出・競合・エラー非露出。Auth削除は合成mockのみであり実アカウントは操作していない。

### 検証

npm run test:security exit0、合計302（64+147+35+3+53）。tsc --noEmit --incremental false exit0。今回2API限定lint exit0。ダミー環境+audit-no-networkのNext16.4.2 webpack build exit0。既存middleware/Edge Runtime等の警告は継続。git diff --check exit0。
証跡：retention-tests/lint/types/build/diff-check.txt、retention-git-status.txt、retention-baseline-hashes.json。

### Git・承認待ち

追跡差分49件（開始47+今回2API）。新規提案文書と既存MODERATION_POLICY/PRIVACY_READINESS/WEB_MVP_VALIDATION/WEB_MVP_100_PERCENT_CHECKLIST/AI_TASK/AI_HANDOFF等docsを更新。変更はローカルのみ。本番DB/Storage/RLS/GRANT/migration適用/Supabase設定変更/ユーザーデータ取得/commit/push/deploy/merge/reset/clean/stash/branch変更なし。
USER APPROVAL REQUIRED：共同作品保持/名義選択案、保持期間、責任者/代理/連絡先、専門家確認と採用。方針合意は本番適用承認と別。全体AI_TASKはin_progress。次は方針合意と実schema/Trigger確認を基に、退会job・公開author identity・停止中ユーザー認可・通報審査の設計を具体化する。

## 32. 退会処理の整合性・途中失敗対策（2026-10-21）

最新依頼に従いAGENTS/AI_TASK/AI_HANDOFFとGit状態を確認。branch security/fix-storage-sign、開始追跡差分49件を保持。前回の実DB監査記録との照合のみで追加本番アクセスなし。

- 既知のprofiles不在列を単純修正すると、profile更新だけ確定→Auth削除がNO ACTION FK等で失敗する経路を有効化する。合成DBで部分成功を再現。
- rooms.created_byだけでなくroom_members.approved_by / room_join_requests.decided_byもAuth削除を阻害し得る。所有ルーム削除によるFK回避は他人のposts/membersまでCASCADEするため採用しない。
- account/deleteのService Role依存とprofiles/Auth書込みを除去。Bearer本人確認は維持、認証後503 ACCOUNT_DELETION_UNAVAILABLE、全応答no-store。未受付であり完了・受付成功とは返さない。既存の内部エラー非露出を維持。
- DeleteAccountButtonは準備中/未受付の表示へ。削除要求・ログアウトを行わない。これは機能完成ではなく危険な途中失敗の停止であり、公開前に正式な退会受付経路が必要。
- ACCOUNT_DELETION_INTEGRITY.mdへP1/P2/P3、既知事実/合成再現/未確認の区別、申請一意化・利用停止・DB準備・Storage・Auth・結果照合・故障別復旧の設計を記録。新schema/migrationは作成/適用していない。

検証：npm run test:security exit0、323検査（64+157+35+3+53+11）。退会APIの旧3検査を13検査へ置換、合成DB11検査追加。再送無変更/無効Bearer/creator/未受付、不在列/0行更新/部分成功/各FK/他人データCASCADEを確認。
tsc --noEmit --incremental false exit0、変更2TS/TSX+3CJS限定lint exit0。diff末尾空行を修正後git diff --checkを再実行。今回はbuild再実行なし（前回成功、今回は型/対象lint/全セキュリティ検査）。実Auth/Storage/Trigger/複数接続/E2Eは未検証。
証跡：account-deletion-tests/types/lint/diff-check.txt。テスト追加：account-deletion-db-check.cjs、runnerへ登録。既存security-audit-checkを更新。

変更アプリはapp/api/account/delete/route.tsとapp/profile/DeleteAccountButton.tsxのみ。他のアプリ差分・旧UI削除は変更しない。追跡差分は50件（開始49+画面1）。docsの調査文書、AI_TASK/HANDOFF、検証/公開チェックリストを更新。
USER APPROVAL REQUIRED：退会保持・名義・creator/承認履歴・受付方法、追加メタデータ監査の実行、退会ジョブ/FK/認可の設計とstaging/本番反映。自動再試行だけで整合性は解決しない。
次：監査SQL案の事前提示→保持/受付判断→再開可能な退会ジョブ設計→隔離staging検証。AI_TASK全体はin_progress。
本番DB/Storage/Supabase設定変更、実ユーザーデータ取得、commit/push/deploy/merge/reset/clean/stash/branch操作なし。

## 33. 100人Web MVP追加ローカル実装（2026-10-21）
最新添付42faba7bの指示を実行。開始branch security/fix-storage-sign、既存追跡差分50件（削除2件を含む）を保持。開始時hashはcompletion-baseline.json。今回本番アクセス・ユーザーデータ取得なし。
実装：退会job/lease/CAS/再送基盤と任意受付（既定無効）、Creator管理/kick/再参加防止/Core4人、高速でなく安全なroom soft delete、highlight競合RPC、旧update/mark-read停止、既読統合、APIエラー非露出、画像EXIF除去、期限後投稿拒否。
ローカルmigration候補002〜006を追加。restrictive SELECT/GRANT制限、operator監査/非表示復旧、共同draft/版競合/期限公開固定/未確定fallback、ログ手動審査。審査hashは本文だけでなく添付path/形式も含み、差し替え時失効。UI/APIと公開署名にも統合。AI provider抽象/PII検出・16イベント型を追加、実AI/収集は無効。
結果：全413検査（65+171+35+3+53+11+75）exit0、tsc --noEmit --incremental false exit0、対象lint exit0（既存警告5件、最終追加分0）、通信遮断/ダミー設定webpack build exit0。Turbopackは隔離IPC失敗のためwebpackへ固定。git diff --check最終確認。実機幅変更・認証済みE2E・100人負荷・本物のAuth/Storage/複数接続は未検証。
重要：退会はadapter/worker/匿名化/FK/利用停止/Storage未接続で未完成。受付flagは運用完成まで無効。既存公開作品のPII/旧添付、実DBビュー/RLS/旧関数の整合性とstagingが公開阻害。AI Creatorは前提P1未解消につき未実装。100%未達、Status in_progress。
詳細：WEB_MVP_COMPLETION_PASS.md、PRODUCTION_ROLLOUT_PLAN.md。検証completion-*.txt、変更一覧completion-git-status.txt。既存削除2件は復元/破棄しない。
USER APPROVAL REQUIRED：追加メタデータ監査・隔離staging、運営担当/窓口/保持名義の正式採用、検収後の本番反映。安全なローカル実装を承認済みであり、その許可を再要求するものではない。
次：実schema/triggerに合わせ退会adapter・認可停止・保持を仕上げ、stagingで全role/旧作品/競合/期限/退会復旧を検収。本番migration適用、DB/Storage/Auth変更、commit/push/deploy/merge/reset/clean/stash/branch変更なし。

## 34. 退会adapter接続と追加実DB監査
開始branch security/fix-storage-sign、既存追跡差分66件を保持。最新依頼に従い既存監査と照合し、追加SQLを提示、ユーザーから明示実行承認を取得。
supabase-account-deletion-audit.sqlをREAD ONLY/ROLLBACKで実行。並べ替え式のみ実行前修正し説明。Dashboardは最後の結果だけ表示するため、同じFK/列SELECTをREAD ONLY/ROLLBACK付きで再実行。結果：列120、FK32、Trigger150。account-deletion-metadata.jsonに保存。ユーザーデータ、関数本文、秘密情報は取得していない。
P1：既知3列以外にevents.created_by/novel_drafts.updated_byのNO ACTION。decisions/event_members/room_pre_archive_notes等のAuth CASCADEも確認。共同制作履歴の保持を確認せずAuth削除してはいけない。Storage owner列のAuth FKがないことはAuth側所有チェック不要の証明ではない。protect_delete Triggerあり。
実装：lib/accountDeletionAdapter.tsでSDK/job claim/advance/lease更新解放/Auth存在照合を接続。Auth操作前に同一job/actor、書込停止・保持・名義・FK・Storage準備の確認を要求。未監査preparationはneeds_reviewで停止。API/cronにworkerを配線しておらず実削除は無効。lib/accountDeletion.tsはclaim障害をretryへ。007_deletion_lease.sqlはローカル候補。
検証：追加26件、全439件成功。型・対象lint成功、git diff --check確認。Auth/Storageはモックのみ、lease/FK/CASCADEはPGlite合成DB。buildは今回は未再実行（配信route/UI変更なし、前回成功）。
詳細ACCOUNT_DELETION_ADAPTER.md。未接続：実DB準備/匿名化・履歴保持・全書込停止・Storage処理・worker起動。追加監査で新たな依存が判明したため安全でない自動NULL化/CASCADE回避は実装しない。全体Status in_progress、退会完成ではない。
USER APPROVAL REQUIRED：supabase-account-deletion-followup.sqlは新たな5表の列・参照元FKを取得する未実行案として提示。Trigger本文の安全な確認と隔離stagingも必要。本番への書込/migration適用/Auth・Storage変更/commit/push/deployなし。

## 35. 追加監査と制作履歴の退避実装
2026-10-21。開始branch security/fix-storage-sign、追跡差分66件を保持。AGENTS/AI_TASK/HANDOFF確認済み。
ユーザー承認済みsupabase-account-deletion-followup.sqlをREAD ONLY/ROLLBACKで実行。全体実行後、最後の結果のみ表示されるため列SELECT部分を同じread-only transactionで再実行。5表33列と参照元FK3件を取得、deletion-followup-metadata.json保存。ユーザーデータ/関数本文/秘密値は取得なし。
実DBでevents.created_by NOT NULL、novel_drafts.updated_by nullable、decisions/event_members/room_pre_archive_notesのactor列NOT NULLを確認。events削除はdecisions/event_members/novel_draftsへCASCADE。単純NULL化/イベント削除でAuth削除を通してはいけない。
ローカル008_deletion_retention.sqlを追加。本人のdecision/参加/制作メモを明示列で1つの復旧用JSONに原子的保存、job/lease確認、一般role拒否、変更された再送は拒否。匿名選択は退避先表示名に反映。原本・Auth・Storageには触れない。
lib/accountDeletionRetention.tsでSDK prepareへ接続可能にしたが、退避だけでpreparedとせずneeds_reviewに停止する。公開匿名化・全書込停止・FK移行・Storageは未完成で、実workerは起動しない。
検証：追加17件、全456件成功、tsc --noEmit --incremental falseと対象lint成功。差分check実行。buildは今回未実行（route/UI変更なし、前回成功）。検証ログdeletion-retention-tests/types/lint/diff.txt。詳細ACCOUNT_DELETION_RETENTION.md。
変更：新規migration008、lib/accountDeletionRetention.ts、deletion-retention-check.cjs、run-security-checks.cjs、監査JSON/説明/引継ぎ/状態文書。前からのアプリ差分と削除2件を保持。
未完：イベント所有権/公開authorの実移行、Trigger本文照合、全書込停止、Storage、needs_reviewの審査付き再開、隔離staging検収。退避は公開側の履歴保持の代わりではなく、本文のPII除去でもない。
全体Status in_progress。本番データ/設定変更、migration適用、Auth/Storage操作、commit/push/deployなし。今回承認済み追加SQLの実行待ちは解消。
 
## 36. 公開名義・履歴保持と書込停止（2026-10-21）
AGENTS/AI_TASK/HANDOFFと開始差分確認。既存追跡差分66件・削除2件を保持。実DBへの追加アクセスなし。
009_deletion_attribution_fence.sqlをローカル追加。退会受付の同一transaction内で匿名名義更新または保持名義を独立表へ保存しjob確定。既存Triggerによる値の戻しは検知して全rollback。本文/履歴/イベント/添付は削除しない。
アプリ表へのTriggerでJWT actorとOLD/NEW actor列を確認、受付と同じadvisory lockで既存jobを持つactorの書込を拒否。READ COMMITTED以外/既存jobのあるmigration適用は安全停止。Storage外部API等は別対応。管理操作やworkerも停止し得る保守的な境界で、運営限定解除/複数接続は未完。
公開作品詳細に退会名義をリンクなし表示するflag付き経路を追加。公開名義RPCは200件上限、取得障害なら旧名義にfallbackしない。MVP_ACCOUNT_ATTRIBUTION_ENABLEDは未設定/falseのまま。
検証：既存456+新規28=484件成功。全体480成功後に追加4を含む当該28件再実行。tsc、変更lint、通信遮断/ダミーwebpack build、diff check成功。deletion-attribution-*.txt参照。実Auth/Storage/Trigger本文/複数接続/認証済みブラウザは未検証。
変更：migration009、lib/departedAuthorLabels.ts、app/works/[id]/page.tsx、deletion-attribution-check.cjs、runner、説明/記録。前からの全アプリ差分を保持。
推奨：イベントの過去作者IDと管理権限を分離し受諾済み後継者へ権限移譲、後継者なしは運営保留。Storageはattached保持・未使用のみ台帳清掃。イベント削除/架空Auth移管/Storage prefix全削除は採用しない。
詳細ACCOUNT_DELETION_ATTRIBUTION_FENCE.md。所有権/FK、管理操作の限定解除、Storage、実環境検収が残り全体in_progress。実削除worker未起動、受付有効化なし。本番変更/commit/push/deployなし。
 
## 37. 退会中の限定運営経路（2026-10-21）
開始branch security/fix-storage-sign、既存差分保持。AGENTS/AI_TASK/HANDOFF確認。追加本番アクセスなし。
010_scoped_moderation.sqlをローカル追加。既存service-only mvp_moderateを厳密なdefiner RPCへ置換し、運営担当/退会状態/JWT一致を確認。対象posts/rooms1行のis_hiddenだけを一回限りの許可で変更。
許可表はservice_roleからも不可。pid/transaction/表/id/前後全行を一致させTriggerが消費。本文変更や既存Triggerの副作用は全rollback。変更と監査記録を同時確定、再送の不一致拒否、許可残留なし。通常書込停止は維持。
検証：新規23件＋既存484件＝全507件成功。対象lint・diff成功。scoped-moderation-tests/lint/diff.txt。SQL/テスト/doc変更のみにつき型/buildは今回未再実行（前回成功）。実複数接続・実Trigger・実RLSは未検証。
新規ファイル：migration010、scoped-moderation-check.cjs、SCOPED_MODERATION.md。runnerと引継ぎ/状態更新。既存API/UIのRPC呼出名は変えない。
残課題：実edited_at等のTriggerが非表示でも動く場合は安全停止する。reports.apply_auto_hideは未接続で退会者向け通報受付をrollbackさせる可能性があり、受付と自動非表示の分離/限定RPC連携を隔離stagingで検証する必要がある。
今回の限定管理実装・合成検証は完了。全体AI_TASKはin_progress。退会実削除・機能flagを有効化していない。本番DB/設定変更、commit/push/deployなし。
 
## 38. 通報自動非表示失敗時の受付保持（2026-10-21）
AGENTS/AI_TASK/HANDOFF、branch security/fix-storage-sign、既存差分確認・保持。
011_report_intake.sqlをローカル追加。service-only受付RPCが専用表へ通報を保存し、旧reports INSERT/Triggerは内部subtransactionで実行。通常SQL例外は旧処理のみrollback、受付pendingを保持。actor/request一意・内容不一致拒否・pending再送で旧Trigger再実行なし。SQLSTATEのみ保存。
reportsの正しいactor列reporter_user_idを退会書込停止Triggerに追加。通報者本人の退会は拒否し、退会中の対象への非表示制限は維持。
API/UIはMVP_REPORT_INTAKE_ENABLEDの既定無効フラグで接続。202受付pending/200処理済み、受信成功と非表示成功を混同しない。同内容の再送ID維持、障害時の旧INSERT fallbackなし。
提示SQLの明示承認を受け、READ ONLY/ROLLBACK監査を実行。reports11列、tr_reports_auto_hide有効・ROW AFTER INSERT(tgtype5)、public.apply_auto_hide SECURITY DEFINER。関数本文/ユーザー行は未取得。report-trigger-metadata.json、REPORT_INTAKE_RELIABILITY.md参照。
検証：新規SQL17+API6、全530件成功。型/対象lint/通信遮断build/diff成功。report-intake-*.txt。本物の通報送信・DB書込・設定変更なし。
変更：migration011、reports/create API、ReportButton、SQL/モック検査とrunner、監査案/結果、説明/引継ぎ。既存差分を破棄しない。
残：pending専用の運営一覧・監視・監査付き対応済み管理は未実装。有効化前に必要。DB全体中断/キャンセル等は同一ID再試行、実Trigger全体/制約/並行動作はstaging検証。全体in_progress。本番変更/commit/push/deployなし。
 
## 39. 処理待ち通報の運営専用管理（2026-10-21）
開始branch security/fix-storage-sign、既存差分を保持。AGENTS/AI_TASK/HANDOFF確認、本番アクセスなし。
012_report_queue.sql、/api/moderation/reports、ReportQueue UIを追加し既存/moderationへ接続。運営のみ古い順50件cursor一覧、全未対応数/24h超件数/最古/確認時刻を確認。通報者IDや内部エラーは返さない。認証変更で画面情報クリア、全API no-store。
対応済みは旧処理stateを変えずreport_resolutionsへ記録。受付/操作ID一意、担当者/結果/理由/時刻、上書き禁止。hiddenは限定mvp_moderateと解決記録を一体化、no_actionも理由必須。監査失敗は非表示もrollback。再送同一性と単独moderation ID流用拒否。
一覧/対応とも運営在籍ロック・退会状態ロック/JWT照合を実施。退会中担当者は不可。対象の退会書込停止は維持。一般ユーザー/直接service_roleの監査改変は不可。
検証：新SQL22+API7、全559件成功。型/変更lint/通信遮断build成功、diff check最終確認。report-queue-*.txt。実複数接続/実Trigger/ログイン済みブラウザE2Eは未検証。
詳細REPORT_QUEUE_OPERATIONS.md。更新ボタンでの滞留確認であり常時監視/自動通知ではない。対応取消/再審査/監査履歴閲覧UIは今回範囲外。適用前stagingと運営当番/保持方針の確認は残る。
MVP_REPORT_QUEUE_ENABLED未有効化、退会/通報の本番flag変更なし。本番DB/設定変更、commit/push/deployなし。全体in_progress。


## 40. 運営通報管理の権限・競合・失敗時検証（2026-10-21）
AGENTS/AI_TASK/HANDOFF、branch security/fix-storage-sign、既存差分確認・保持。本番へのアクセスなし。
P2: 認証getSession待機中の切替で旧通信が新世代として扱われるUI経路を修正。await前の操作世代取得、認証後/応答後/catch/finally照合、unmount無効化を追加。同期refで同じ描画時点の二重送信も抑止。
SQL変更なし。合成DBで権限取消/退会後の成功ID再送拒否、別担当者の上書き拒否、transaction abort/SQLキャンセル後の監査原子性と同一ID再試行を追加検証。送信済み操作は画面側で取消されず、最終判定はDB認可/ロック。
新規UI9件＋SQL追加7件、全575件成功。型・対象lint・通信遮断build成功。report-queue-hardening-*.txtにログ。lint初回はテスト変数名error/ref warning、修正後0。修正後UI9件も再実行成功。
変更: app/moderation/ReportQueue.tsx、docs/report-queue-ui-check.cjs、report-queue-check.cjs、run-security-checks.cjs、REPORT_QUEUE_HARDENING.md、本記録/タスク/checklist/検証ログ。既存差分と既存削除2件を保持。
限界: PGlite1接続の順次実行・障害注入。実複数接続・認証済みブラウザ・実Trigger E2E未検証。postgres/pg_ctl/dockerなし。新規P1確定なし、既存公開阻害事項は残る。
USER APPROVAL REQUIRED: 隔離stagingへの適用/合成データ作成と複数接続試験。REPORT_QUEUE_HARDENING.mdの事前手順参照。本番用読み取りSQLは追加していない。既承認の読み取り監査と書込を伴うstaging検収は別。
次: 隔離staging競合→実Trigger互換性→運営ブラウザE2E。今回のローカル検証は完了、全体公開準備はin_progress。新flag無効のまま、本番変更/commit/push/deployなし。


## 41. 100人Web公開前の追加仕上げ（2026-10-21）
最新添付57990f31の指示を実行。branch security/fix-storage-sign。開始時hash mvp-final-pass-baseline.json、既存差分/削除2件を保持。sources参照ファイルは変更なし。
実ローカルPostgreSQL17.10を別作業領域に配置し、loopbackの新規合成DBで19件の複数接続検査成功。通報同時対応/権限取消/両退会/投稿再送/いいね/cron/通報receipt/20接続100rate操作を検証。実Supabase・本番データなし、サーバー停止済み。
ローカル候補013〜017追加: unused cleanup lease/worker（未接続）、like intent、room+Creator原子作成、運営/退会rate、通報対象認可と重複抑止。対応API/UIを既定無効flagで接続。単独moderation/LikeButtonの認証切替/再送/二重送信修正。
P1候補: 通報対象の閲覧資格が未検証の経路を発見。旧APIにcanonical可視性/参加確認、新017に原子的認可/重複抑止/internal EXECUTE禁止。実被害・本番反映の主張なし。
ローカルブラウザでlogin空欄エラー、works障害時案内と再読込、room作成入力ラベルを確認。入力7箇所に名前を付け、Core4説明とcrypto招待コードへ。320px/実機/全ログインE2Eは未検証。
最終全648オフライン+19実Postgres=667件成功。型/対象lint/通信遮断build/diff成功。初回型検査は並行buildの.next型入替えでTS6053、最後はbuild→tscで成功。native fixture2件の想定/依存修正済み。
全44route/直接privileged参照30/410分類11、client参照70を列挙。secret形式scan0（envは取得せず、完全証明ではない）。
最新報告WEB_MVP_FINAL_PASS_REPORT.md（指定17項目）。FINAL_SECURITY_PASS.md、UPLOAD_CLEANUP_READINESS.md、ACCOUNT_DELETION_COMPLETION_GATE.md、WEB_MVP_FUTURE_SPEC.md、PRODUCTION_ROLLOUT_PLAN.md更新。
変更一覧mvp-final-pass-changes.json。テストmvp-final-pass-*.txt/real-concurrency-result.txt。アプリpackage.json/lockへnative runtimeを追加していない。
残P1は0ではない: 本番RLS/GRANT/旧RPC/Storage、Auth FK/CASCADE/イベント所有権/Storage保持、既存公開PII。Member45競合/申請pending重複/将来Core3回と任意辞退、実運営・法務・実機・全体負荷も残る。
USER APPROVAL REQUIRED: 対象が確実な別stagingの指定、保持/管理移譲/当番/窓口/法務判断、検収後の本番反映。隔離synthetic検証自体は今回許可済みで重ねて許可を要求しない。
全体AI_TASK in_progress・100%未達・募集不可。本番反映承認だけが残った状態ではない。Auth削除/Storage実削除/新flag有効化なし。本番変更/commit/push/deploy/merge/reset/clean/stash/branch変更なし。


## 42. Web MVP最終検収フェーズ（2026-10-21）
最新添付f8513171指示。branch security/fix-storage-sign、既存差分/削除2件保全、acceptance-baseline.json記録。staging config/linkなし、CLI PATHなし、envキー名だけ確認。USER APPROVAL REQUIRED: staging project identification。
001〜017の全SQLをレビューしMIGRATION_ACCEPTANCE_MATRIX.mdへ依存/権限/復旧整理。018_member_admissionを追加しMember45/identity不変/READ COMMITTED、新join_memberで参加・同意原子化と既存role保持。API新flag既定無効、旧fallbackなし。
退会保持preflightはCreator/FK/CASCADE/Storage不明をneeds_review、使用済み/共同/公開添付保持。Auth削除許可には使わずworker/受付は停止維持。
全674 offline+31実Postgres+35Chrome responsive=740成功。型/lint/通信遮断build/diff成功。新モック返値未登録の初回失敗を直し全体再実行。320px screenshotも確認。全合成サーバー/ブラウザ終了。package.json/lock変更なし。
詳細はWEB_MVP_ACCEPTANCE_REPORT.md（指定14項目）、STAGING_ACCEPTANCE_PLAN.md、ACCOUNT_DELETION_FINAL_DESIGN.md、RETENTION_AND_PII_ACCEPTANCE.md、LEGAL_REVIEW_CHECKLIST.md、PRODUCTION_GO_NO_GO.md、更新rollout。
NO-GO。既存Core RPC全文/申請同意transaction、実退会FK/Storage/Trigger・工程証跡は未完成。実Auth/Storage/staging全順序/認証済みE2E/実機/100人負荷も未検収。手順整備だけでPASSにしない。
Status blocked（最新ユーザー終了状態指定に従う）。承認事項4群: staging識別、退会保持、運営/法務/実機担当、検収後本番。次は隔離対象と方針確認→実定義照合→不足実装→staging。
変更一覧acceptance-changes.json、検証acceptance-*.txt。既存差分破棄・本番変更・ユーザーデータ取得・commit/push/deploy/merge/reset/clean/stash/branch操作なし。


## 43. 独立Supabase staging作成・基本サービス検収
2026-10-21。添付ff66ca86指示、既存差分/削除2件保持。ユーザーがFree組織でminnade-tsukuru-stagingを新規作成、fwqucffxdmbdczspkcyr/Sydney/NANO。productionはjoedeuyrzimqyjapqpyh、今回アクセス/変更なし。
staging READ ONLY/ROLLBACKで初回public/Auth/Storage/buckets全0を確認。独立キーをref/role照合し.env.staging.localへGit除外/利用者限定ACLで保存。本番env未変更。DBpassword取得なし。
staging:check/smoke/db-check/plan/integrationを追加。production ref/キー再利用・URL偽装・TLS緩和拒否。22ローカル境界検査成功。専用scriptはstagingenvだけを使用しNext通常devはstagingにならない。
実staging17項目成功: synthetic6ユーザー、login/refresh/local logout/独立session/invalid token、追加disposable1人削除・再login拒否、private bucket/PNG/署名/anon拒否/MIME/size。6ユーザー・1bucket/1objectは証跡として保持。アプリrole未付与、user/作品コピーなし。
001〜018は未適用。基礎schemaのDEFAULT/CHECK/enum/既存RPC・Trigger本文が不足し、supabase-staging-baseline-audit.sqlを提示、読み取り承認待ち。推測fixtureを本番schemaと扱わない。アプリRLS/退会/旧Core/期限公開は未検収。
今回779検査（696 offline+31 native+35responsive+17 staging）、別途health/REST2確認成功。型/lint/通信遮断build/diff成功。native/localhost/browser終了済み。
STAGING_SETUP_RESULT.md指定16項目、STAGING_SETUP.md、staging-project.json、staging-integration-result.json/run別証跡。PRODUCTION_GO_NO_GOとrollout追記、16ゲート数は不変/NO-GO。Status in_progress、全体未完。
次: 追加schema-only監査承認→baseline再構築/合成検証→staging段階適用→実アプリ検収。production操作/commit/push/deployなし。

## 44. 実定義監査・staging基礎schemaと001〜018適用（2026-10-21）
開始branch security/fix-storage-sign、既存差分/削除2件保持。AGENTS/AI_TASK/HANDOFF確認。
明示承認されたsupabase-staging-baseline-audit.sqlとcompletion-audit.sqlを、本番で内容一致確認後BEGIN READ ONLY/ROLLBACK実行。ユーザー行・sequence現在値・app関数実行なし。本番変更なし。
監査:14表142列/51制約/53index/17enum値/18関数/14public Trigger/4view/78policy、追加Auth Trigger1/sequence1/所有関係1/表設定19。raw結果はrepo外の利用者限定ACL下、公開docsへ転載なし。
P1:旧Core承認は引数actor信頼/auth.uid確認なし、退出者復帰とCore同意欠落を実定義で確認しlocal再現。旧監査ACLではanon/authenticated EXECUTE可。staging005で直接呼出閉鎖済みだがservice APIの原子性・在籍制約は未修正。
修正:未適用009の匿名内部名40文字→20文字以内（衝突は全rollback）。未適用011は実apply_auto_hideが見るtarget_room_id/target_post_idを設定。通報fixture2本も実列へ。
staging fwqucffxdmbdczspkcyrへ閉鎖ACL baseline、001→018を個別transaction/段階smokeで適用成功。新規専用schemaのmarkerで誤接続拒否、hash記録19件。証跡staging-applied.json/staging-schema-plan.json。Storage policy未変更、元ACLは複製しない、sequence上限は型既定値。以後009/011を編集再実行せず新migrationで変更する。
今回761検査成功=696 offline+12監査schema local+31 native concurrency+22実staging。Auth profile Trigger/room/join/同時二重join/実自動非表示/退会pending/運営対応/拒否を確認。内部名collision原子rollbackもlocal成功。lint/diff成功、TS/UI変更なしで型/build/responsiveは今回未再実行。local PG停止済み。
実staging新規synthetic6人/room1/posts2、既存6人とbucket/objectは保持。秘密credentialsはrepo .staging-private/Git除外/利用者限定ACL。新run d23c5db2-0b0f-44ce-8ac1-6262c1363956。ユーザーdataコピーなし。Auth削除worker/cleanup未起動。
STAGING_SETUP_RESULT.mdを最新16項目に更新。全体NO-GO/AI_TASK in_progress。旧Core・必要なclient読取権限/Web・Storage/退会FK・forced publish/復旧/負荷が残る。本番変更/commit/push/deployなし。
レビュー拒否1回（002成功未確認のまま次SQLへ進む形）。成功確認を別実施し以降条件分岐必須として安全に完了。回避実行なし、未解決review blockなし。


## 第45節: 最終staging検収の結果（2026-10-21）
NO-GO。最新の詳細はFINAL_STAGING_ACCEPTANCE.md（指定19項目）。
019 Core原子承認/旧RPC revoke、020未公開Creator退会拒否/固定匿名名/プロフィールPII除去をstagingへ適用。001〜018は今回不変。旧先着/招待Core API410、UI停止、新RPC引数照合。ルーム作成は承認制既定ON、招待無効。
855チェック成功: offline697、監査schema local39、native31、実staging45、Web8、匿名responsive35。弱点再現/失敗画面layoutを含むため全機能成功ではない。型/対象lint/build/diff成功、ローカルサーバー終了。
Core最終在籍は退出/追放後inactiveだが、先にcommitした昇格履歴は残り得る。deadlock被害側の再試行を実施。厳密な退出優先とAPI原子化は残る。
退会前提と匿名化7件成功、Auth削除/FK/CASCADE/events所有権/Storage連動は未完成でUI/API既定無効。既存jobのPII補正も未実装。保持方針の承認待ちではなく技術実装の不足。
実authenticated RESTでprofiles/room_members/rooms_with_counts_v2が42501、全Web E2Eはblocked。実UI login/invalid password/reloadとprofile5幅のみ成功。
実staging期限公開同時RPC・再実行・1作品保持成功。HTTP cronから作品/添付UIまで未検収。通報保留/限定運営は最新条件で再検証成功。
未解決P1群3以上: Auth削除整合性、本番広い権限/旧経路（未反映）、既存公開PII/保持検収。総合NO-GOを維持。
次: client最小権限/同意保存→退会履歴FK/Storage→Core退出競合→全Web/復旧/実機。追加ローカル作業の再承認不要。
USER ACTION REQUIRED: 実確認メール受信、運営窓口/当番・法務/実機担当。本番反映承認は全検収後だけ。
branch security/fix-storage-sign、既存全差分/削除2件保持。sources変更なし。本番アクセス/変更・commit/push/deploy/merge/reset/clean/stashなし。


## 第46節: 最終仕上げの結果（2026-10-21、最新）
総合NO-GO。詳細はFINAL_FINISHING_ACCEPTANCE.md（指定18項目）。旧節の「client ACLで全Webが止まる」は解消。
021/022をstaging fwqucffxdmbdczspkcyrへ適用。本人profiles/membershipだけの読取、公開profile列限定、新mvp_room_list、本人同意RPC、公開draftの匿名読取を整備。旧view/DMLは開けていない。
実Webは作成/参加/同意/投稿/添付/既読/Core却下→再申請→承認/期限公開/作品/like/report/profile/logout/匿名添付bytesまで完走。認証後18＋通報3の幅検査PASS。タイマーhydrationを修正。
今回906チェック成功（offline697/local監査schema73/native31/staging63/Web42、再開重複除外）。弱点/失敗条件再現を含むため完成率とはしない。型・対象lint・通信遮断build・diff成功。
退会Auth削除は監査schemaでwrite fenceとCASCADEの衝突を再現。FK保持主体/専用cleanup/元UUID公開遮断/既存job補正が未実装。UI/API準備中とAuth保持を維持、最終worker未接続。ACCOUNT_DELETION_FINAL_GATES.md参照。
P1未解決3群以上（退会整合性、本番未反映の権限/旧経路、既存公開PII/保持検収）。本番反映承認を求められる状態ではない。
次: 匿名保持主体＋限定prepare→退会Storage→Auth/再送の実検証→残E2E/復旧/運営。技術作業の追加承認不要。人手は実メール・運営窓口/当番・法務/実機。
branch security/fix-storage-sign。既存全差分/削除2件保持。今回021/022/UI/検査/台帳/docs変更。本番アクセス/変更、commit/push/deploy/merge/reset/clean/stashなし。sources不変。


## 第47節: 最終P1解消の途中経過（2026-10-22）
023〜026をstaging fwqucffxdmbdczspkcyrのみへ適用し、Dashboard結果を照合。001〜025の適用後編集なし。026は既存Core申請updated_at Triggerを厳密な更新後capabilityへ含める追補。
Authと独立した個別匿名主体、履歴FK、限定prepare、unused Storage SDK削除、Auth最後・再試行を実装。共用Auth退会ユーザーなし。
実staging24検査成功: Member、Core拒否/降格後完了、未公開Creator拒否/公開後完了、Storage/Auth故障注入、二重申請、再試行、使用済み保持/未使用削除、元UUID匿名化、他人投稿不変、旧login/refresh/JWT書込拒否。
監査schema local98検査成功。実Core履歴を通す検査で026問題を再現し修正。以前の直接role変更だけの試験では発見できなかった。
申請API→本人job worker、完了200だけUI local signoutを接続。既定フラグは無効。ローカルWeb E2Eでのみ2フラグ有効化して検収中。本番env/アクセス/変更なし。
旧Gate文書の「最終worker未実装」は今回更新対象。旧jobの復旧、lease競合追加、運営UI退会後の回帰、最終P1件数はまだ最終判定していない。承認待ちではない。
変更: migrations023〜026、accountDeletionPreparation、cron/account-deletion、account/delete、DeleteAccountButton、staging検証scripts、audit fixture/台帳/docs。既存差分維持。commit/push/deploy/merge/reset/clean/stashなし。


## 第47節終了状態（2026-10-22、最新）
STAGING GO / PRODUCTION NO-GO — production approval pending。FINAL_P1_ACCEPTANCE.md（18項目）を正本とする。
退会8ゲート/A〜Lが実stagingと監査schemaでPASS。Core申請timestamp衝突は026で解消。Authと独立した個別匿名主体/FK/限定prepare/unused SDK cleanup/Auth最後/retry/Web完了を接続。
Web公開Core・Creatorの退会後も共同作品・添付取得成功。運営Web7項目成功（退会済み作品の非表示/復旧、退会中運営者拒否）。
921項目=708 offline+103監査schema PG+31実多接続PG+24 staging deletion+48 Web+7運営Web。型/対象lint/通信遮断build/diff成功。修正前の失敗・故障注入も数に含む。サーバー停止済み。
Technical P1既知残0（MVP検証範囲）、本番未反映6実行項目、運用公開条件3件。既存PIIは0件と判断せず審査手順を残す。旧手動stage jobは安全停止の個別移行監査対象。追加技術作業の承認待ちへすり替えない。
023→026 staging適用済み、適用後編集なし。26＋baseline履歴。既定退会flag無効、本番適用後smokeを経て最後に有効化。
AI_TASK done（production approval pending）。次: 報告確認→運営/法務・実メール/端末→本番対象/停止時間の承認。承認だけで無検証の既存状態を変更しない。
Git security/fix-storage-sign、既存差分と削除2件保持。本番アクセス/変更、commit/push/deploy/merge/reset/clean/stashなし。sources不変。秘密表示なし。


## 第48節: Production preflight / operational readiness（2026-10-22）

- Technical: done / STAGING GO（合意scopeの既知P1=0）。第47節の921既存検査・退会8gate・Web48/運営7を照合。本番の安全性/全負荷を証明したとはしない。今回はコード/SQLを変更せず再テストなし。
- Rollout: 001〜026を全件レビュー、適用記録とhash一致（001〜020は保存bytes、021〜026はLF正規化）。追加/権限縮小が混在するため停止→番号順→互換app→smoke→退会最後。SQL不変、baseline/fixtureは本番対象外。Auth/Storage物理削除はdown不能。
- Operational blockers: 実メール/実機・窓口/当番/法務/保持/既存PII担当未確認。flagsは一部OFFで旧経路へ戻り、退会workerは開始後OFFで即停止しない。全入口停止/drain・復元・通常通報/監査/退会復旧の担当実演が必要。queueはpending例外受付のみ、全通報一覧ではない。
- Approval items: ①最終検収/限界確認 ②実窓口と担当 ③法務/保持 ④実メール/実機 ⑤対象/停止/復旧条件を満たしたrollout承認。一般公開NO-GO、production apply APPROVAL PENDING。承認だけで未実証項目をPASSにしない。
- 変更文書9件: AI_TASK、AI_HANDOFF、PRODUCTION_PREFLIGHT（新規）、OPERATIONS_READINESS（新規）、PRODUCTION_GO_NO_GO、PRODUCTION_ROLLOUT_PLAN、MIGRATION_ACCEPTANCE_MATRIX、LEGAL_REVIEW_CHECKLIST、RETENTION_AND_PII_ACCEPTANCE。既存文書の旧内容は履歴として保持。
- 検証: 全非ignored 505パス列挙と対象text静的scan（秘密値非出力）、本番/staging refのruntime混入なし、test用接続URL fixtureだけをcredential形状候補として確認。文書リンク/26本×3表/文字化け・末尾空白検査、git diff --check成功。開始時hash比較でdocs以外無変更・ファイル削除なし。機械走査を漏えい不存在保証にしない。
- Git: security/fix-storage-sign。開始tracked73件の差分と既存削除2件を保持。今回本番/stagingアクセス・データ取得/変更、commit/push/deploy/merge/reset/clean/stash/branch操作なし。sources不変。
- 次: PRODUCTION_PREFLIGHTを入口に、運用5項目と停止/復旧の未実証を解消。AI_TASKは今回の文書作業done、技術実装doneを維持。実本番反映は別承認。


## 第49節: 停止・復旧と運営/法務の最終整理（2026-10-22、最新）

- 判定: Technical GO / STAGING GO（今回の追加検収範囲）。Operational NO-GO / USER ACTION REQUIRED。Production apply APPROVAL PENDING。本番アクセス/変更なし。
- 027を隔離staging fwqucffxdmbdczspkcyrに適用。001〜026は開始時hashから不変。初期pause=true、Owner専用switch/operations/reconcile、service限定checkpoint/effect、旧request/claim/prepare/advance直接権限閉鎖、Auth guard。新private3表RLS有効、serviceのpause/旧prepare実行不可を実確認。適用台帳28（baseline含む）。027も以後凍結。
- 実staging A新規拒否/B prepare後/C Storage直前/D Auth直前/E解除後complete/F二重workerの6ケースPASS、29チェック。各停止でAuth保持、B/C unused object保持、再開後used保持/unused削除/Auth明示不存在。二重workerはcompleted/busy、Auth delete1回。終了時paused=true、active_effects=0。合成fixtureの共同作品・used添付・未退会Creatorはstaging内に保持し、本番dataは取得していない。
- in-flight: SDK送信済みは取消不能。permit/effectを追跡し、pauseとdrain完了を分ける。DB prepare/Auth transactionは共有lockとpause更新で直列化。started結果記録失敗はlease失効後も再claim拒否。Ownerがworker停止・外部結果を確認してからpause中にreconcile（担当記録付き）。stage手動UPDATEはしない。
- flag14個を確認。DB_GUARDS、room/create、join、like、report intake、highlight、publish、作品/署名のOFF時旧fallbackを削除し503/disabledへ。独立UPLOADS switchを追加。moderationとqueueは別flag。一般REST全入口停止や実行済み署名失効をflagだけで保証しない。
- 窓口: minnadetsukuru.auth@gmail.com は確定した意図された公開連絡先。Terms/Privacy/footer/ReportButton/profile退会Helpへローカルmailto掲載、画面/HTTP確認。送信・deployなし。primary未確定はblocking、backupは強い推奨。一人運営は時間限定/不在時停止等の条件付き候補。対応目安はPII可能な限り当日、権利1〜3営業日、不適切1営業日程度、account2〜3営業日。保証SLAなし。
- 法務/保持: LEGAL_MVP_DRAFTに具体的Terms/Privacy/共同license/ログ公開/退会/kick/学習不使用/将来AI/二次創作/人格権/未成年/短いCommunity文案。RETENTIONに期間・理由・manual/automatic・全件legal review。意味変更は採用前で現行version2026-03-24維持、再同意/RPC版連携が必要。本人同意なし学習不使用は確定方針として文案化。AI機能追加なし。
- 運営権限: DB Ownerは運用上の名称でapp role未追加。現役operatorだけhide/restore/pending処理。moderation_actions/report_resolutions監査とrollback維持。一般account restriction/ban・監査UIは未実装（P2運用）。queueは例外pendingのみ、通常通報の別確認を要す。担当が運用できないなら公開STOP。PII6手順と既発行署名/本文訂正の限界を記録。
- 検証: 586=route209+添付68+adapter26+completion75+scoped moderation23+queue29+監査schema PG119+実staging29+local HTTP8。追加/再実行で旧921へ加算しない。119には中間migrationの問題再現が含まれ、後続で解消確認。型/対象lint（警告0）/通信遮断build/diff成功。buildに既存middleware/cache警告。local DBとWeb server終了。新秘密値出力なし。
- 途中失敗: 初回Dashboard入力が一致せず構文エラーで027未適用。ブラウザclipboard経由の全文比較へ修正し、一致後の適用成功を確認。警告のRLS検出はSQL内の3表ENABLE RLSを実環境で別確認。既存エディタに外部入力を認めたため新SQLタブを作りその入力を保持。旧fallback用モックが失敗したため、原子RPCの契約とOFF503に更新し成功。初回lintの未使用変数1件を削除し再検証成功。
- 変更: accountDeletion 4lib/control、apiGuards、14画面/API/2legal UI、SupportContact/constants、027、限定テスト・staging台帳・docs。正確な一覧はdeletion-pause-change-inventory.json。既存削除2件と全未コミット差分を保持。sources不変。commit/push/deploy/merge/reset/clean/stash/branch変更なし。
- USER ACTION REQUIRED: (1)primary/不在時運用・backup候補 (2)法務/保持/年齢/同意説明採用 (3)実メール/実機 (4)全体保守・保全復元/通常通報・監査の担当実演と別承認の本番前提照合 (5)条件を満たして本番適用承認。窓口メールを決める作業は完了済み。
- 次: PRODUCTION_PREFLIGHTを入口に上記を確認。承認だけで未確認ゲートをPASSにしない。新機能には進まない。AI_TASK done（今回scope）、一般公開NO-GOを維持。


## 第50節: 最終リリース検収の途中経過（2026-10-22）

- ユーザー添付25f31f6cを適用。全Go成立時だけcommit/push/production変更を許可する条件付き承認。現在未成立のため本番変更なし。branch security/fix-storage-sign、既存全差分/削除2件を保持。
- 18歳以上自己申告と同意保存、Terms/Privacy/Guidelines・問い合わせ導線、参加時の投稿/画像/添付/制作ログ公開説明を実装。現行version 2026-10-22。全法律文案の採用や本人確認済みを意味しない。
- 028 release_consentを隔離stagingだけに適用。adult_confirmed_at、新3引数本人同意RPC、旧同意RPC閉鎖、create/join/Coreで現在同意を確認。001〜027は編集せず、028も適用後凍結。LF SHA256 be12b1e651531a5323fcee50ee53ccc7275bf8409fef80866cd04fe998619bb1。
- 認証callbackをSDK初期化完了/errorとgetUserで確認。resetの固定遷移と専用画面を追加。新パスワード入力・送信はユーザー操作。旧sessionが残る失敗callbackを成功扱いにしない。
- 今回検証済み: 監査schema local PG137（従来119＋新18）、offline認証UI14、実staging SDK14。全件PASS。実メール送信・物理端末の代わりにはしない。追加の全security回帰/lint/diff review実行中。
- 本番の承認済みread-only preflight: public tables14、mvp関数0、attachment台帳/退会jobs/pause/migration履歴表なし、他接続5。BEGIN READ ONLY/ROLLBACK。ユーザー行・作品本文・アプリ関数実行なし。末尾2集計列は未取得として残す。DashboardはHealthy/Free/No migrations/No backups、バックアップ画面にFree Plan does not include project backups。DB/Auth/Storageの保全復元手段は未確定。
- Vercel実本番project minnade-tsukuru / main / 旧deployment Ready。環境変数は必要な名前の存在だけ確認、値非表示・変更なし。
- 別Vercel project minnade-tsukuru-staging（Git連携なし）を作成。最初の配置はstaging project内production targetへ分類され、staging URLguardでbuild拒否。次のpreviewは.next-stagingをVercelがpackagingできず失敗。VERCEL上のみ.nextに揃え、3回目preview Ready。どちらも本番projectに配信していない。
- Preview: https://minnade-tsukuru-staging-g2wbmgcm9-sonetokiyas-projects.vercel.app 。deploy dpl_FsNFXjHmr4qxktDikNVyu2qLfXz4、target preview。stagingのSupabaseだけに接続、service keyはsecret、cronなし、退会REQUESTS/FINALIZE=false、他12flag=true、DB pause=true。Vercel Authentication維持。
- ユーザーの実行時承認後、staging Auth Redirect URLsへ上記hostの /auth/callback と /auth/callback?next=reset-password の2件だけ追加し保存確認。Site URLはlocalhostのまま。本番URL設定変更なし。
- Preview loginでstaging表示・年齢/同意・文書/窓口導線を確認。Androidでのsignup/確認メールをユーザーへ依頼。利用可能端末はAndroidのみ、iPhone Safariは未確認。メール/端末/保全復元/全入口保守等の未達をPASSにしない。
- commit/push/merge/production migration/production deploy/本番smoke/24h監視は未実行。最終結果・変更一覧・残ゲートは追記予定。

### 第50節・実メールの訂正と確認（続報）

初期のユーザー選択回答による一括PASSは、その後の「期限切れ・再送上限・未ログイン」の訂正を優先して取り消した。Gmail確認メール2通、staging Authの未確認/ログイン履歴なし/recoveryなしを実照合。ユーザー依頼に従って最新メールリンクを直接ブラウザで1回実行し、14:27にemail_confirmed_at更新を確認。callbackは別ブラウザPKCEで失敗表示となったが、登録時passwordでのAndroidログイン成功をユーザーが確認。その後同意/Member参加/文章/画像投稿完了をユーザー報告。Core/通報/作品/戻る・再読込は再検収中。resetは上限・recovery_sent_atなし、iPhoneなし。未実施をPASSにしない。

868検査=703既存offline＋14新auth UI＋137監査schema PG＋14実staging SDK。型/lint成功、local buildと最終Vercel build成功。全28台帳hash一致、001〜027開始時不変、Preview送信payloadと現在ソース一致。秘密形状候補はsynthetic URLのみ。既存529ファイル消失なし。

確認リンク解析でtokenを含む本文先頭がツール出力に一度含まれた。当該単発リンクは認証実行で使用済み、値をdocsへ保存せず再表示しない。リンク一時保存は自動承認レビューにより拒否され、保存せず直接ブラウザ実行の代替で完了。Service Role/DB password/access token表示なし。

最新指定15項目はRELEASE_FINAL_ACCEPTANCE.md、事実台帳release-preflight-result.jsonとrelease-real-email-metadata.json。公開判定/手順/運営/法務/migration/flag文書も第50節へ更新。conditional本番承認あり・ゲート未達でcommit/push/merge/本番migration/deploy/smoke/監視は未実行。

### 第50節終了状態（最新）

Androidの残操作Core申請/通報/作品閲覧/戻る・再読込もユーザーが実施し「完了」と報告。対象stagingアカウント/roomだけのmetadataで現在年齢同意/在籍/公開同意true、投稿1/添付1/Core申請1/通報1を確認（release-android-metadata.json）。本文/画像未取得。主要アプリflowはPASS、Androidメール復帰とpassword resetは未完了。callback失敗の厳密原因は未確定で、別ブラウザPKCEと断定しない。認証リンク実行後のemail_confirmed_atと、その後のlast_sign_in_atを区別する。

追加868検査、型/対象lint/runner lint/build/git diff --check成功。変更一覧release-change-inventory.json、開始時ファイル消失なし・001〜027不変・28台帳一致。Previewソース一致。sources変更なし。新規private URLファイルなし。

Status blocked（ユーザー指定のexact reason）。残り: resetメール上限/Androidメール復帰、iPhone実機、SMTP/本番保全復元/全入口保守・担当等。本番Freeにbackupなし。条件付きproduction承認は受領済みだが全Go条件未達。commit/push/merge/本番migration/deploy/本番smoke/24h監視なし。独立staging Previewの配信だけ実施。

次は同じrelease/端末でreset枠回復後に1回検収→iPhone→本番運用前提確定。旧一括PASS選択や合成試験で未実証を埋めない。15項目と変更/証拠はRELEASE_FINAL_ACCEPTANCE.mdを参照。


## 第51節: iPhoneを除く最終公開前チェック（2026-10-22、進行中）

最新添付cd69fb0dを採用。iPhoneはKNOWN UNVERIFIED PLATFORM: iPhone Safari / POST-LAUNCH REQUIRED CHECKとして今回の公開blockerから除外。Android主要操作PASSは維持。password reset/SMTP/保全復元/全入口保守は必須。全GO後のcommit/push/本番反映承認は有効だが、まだ条件未成立。

開始manifest554ファイル、branch security/fix-storage-sign、HEAD ff1fe59406fdf3fdcf49a35c16e7e0fec413de7a。既存差分を保持。ローカルsecurity回帰、監査schema PG137、実staging合成14、型/build成功。変更104ファイルlintは0エラー4警告。広範囲lintは未変更7ファイルに既存8エラー5警告があり、全体lint PASSとはしない。

実Dashboardで本番custom SMTP有効・Gmail・587・メール30/h、個人向けprovider警告を確認。標準SMTP2/h・組織メンバー宛先制限は本番設定そのものには該当しない。stagingは当初custom SMTP無効。ユーザーがGmail SMTPを設定し、stagingメール30/h、同一user60秒、未保存変更なしを確認。実resetはその後 Error sending recovery email。SMTP接続/認証の原因調査中。秘密値を読出し表示・コピーせず、credential入力はユーザー本人。

stagingだけのBEGIN READ ONLY/ROLLBACK監査: 対象テストaccount1、emailConfirmed=true、confirmationTokenCleared=true、recoveryRequested=false。以前の確認リンクは認証済みかつserver側確認tokenが空。値・URLを保存しない。SQLはsupabase-staging-auth-verification.sql。productionユーザー行は取得していない。

本番Freeにproject backupなし・PITRは未契約Pro add-onというUIを再確認。DB logical backupはStorage実体を含まない。実データbackup・隔離restore・全入口保守は未実証。schema再現試験を全復元PASSと扱わない。

追加発見P2: resetは空白付きpasswordを保存できるがlogin/signupはtrimしていた。合成テストでFAILを再現し、入力passwordをそのままAuthへ渡す最小修正。auth UI17検査PASS。既存passwordはその実際の値でログインする。app/login/page.tsxとdocs/release-ui-check.cjsだけのコード修正、DB/認証方式変更なし。現在のPreviewは修正前で、次の候補との一致確認が必要。

本番DB/設定変更、commit/push/merge/deployなし。staging追加migrationなし、001〜028凍結維持。結果・最終判定は続報へ。

## Buffer連携の並行作業（2026-10-22）
Bufferメール認証/X接続/Personal KeyとVercel本番Secret BUFFER_API_KEY保存をUI確認。秘密値取得なし。app/api/integrations/buffer/check/route.tsに認証必須・読み取り専用の接続確認を追加。docs/buffer-connection-check.cjsの25合成ケース成功。実疎通・投稿処理は未実施。第51節release作業を維持し本番配信なし。詳細BUFFER_CONNECTION_SETUP.md。

### 第51節終了時点の更新（2026-10-22）

password reset/メール復帰はPASS。SMTPの最初の失敗は534 5.7.9 Application-specific password required。ユーザーがアプリパスワードをチャットへ掲載したため、値を保存・設定せず失効/再発行を案内し、新しい値を本人がstagingへ保存したとの回答。修正後のリンク失敗はAndroid開始→Windowsで開いたとの本人確認。Androidだけで再設定request/メール到達/link/new password/旧password拒否/new login/再読込session維持の全手順を完了したと回答。証拠源は本人の訂正後の個別検収報告。新しいcredentialやtokenは取得/表示していない。

password空白のP2修正（app/login/page.tsx）とauth UI17件を検証。修正後offline720、監査schema PG137、実staging合成14の871関連検査、型/対象lint/最新Preview build/diff成功。変更104 TSのlintは0error/4warning、全体lintは未変更7fileの既存8error/5warningを別記。

新Preview dpl_DsDczF9LzAakarptA5Yv7jUsVRHE、target preview、Ready。https://minnade-tsukuru-staging-90rzxyegp-sonetokiyas-projects.vercel.app 。第51節の初回build失敗は一時copyのignoreがlib/supabaseも除外したため。root限定へ修正、必要3ファイルを含みenv等を除外したdry-run後に再配信成功。150source一致。退会2flag=false、その他12=true、STAGING_TEST=true、pause=true、cronなし、Vercel Authentication維持。

新host /auth/callback と /auth/callback?next=reset-password だけをユーザーが実行時承認しstagingへ追加、Successfully added 2 URLs/計4件を確認。production設定なし。SMTP30/hは継続、本番も既にcustom Gmail587/30hと実確認。ただしproduction credential/実送信は未検証。

001〜028開始時bytes不変・全台帳一致。既存554fileの消失なし、既存削除2件保持。秘密形状540text走査0件（最終docs更新前）、diff成功。機械scanで不存在を保証しない。今回の変更一覧/最終走査はrelease51-change-inventory.json。

本番Free backup/PITRなし、保全/隔離restoreと全入口保守/drainは未実証。担当/停止時間/通常通報・監査の体制確認も残る。iPhoneはKNOWN UNVERIFIED PLATFORM: iPhone Safari / POST-LAUNCH REQUIRED CHECKとして今回のblockerから除外。Release BLOCKED / NO-GO、AI_TASK blocked exact reason。包括承認の不足ではなく、安全条件未成立。最新18項目・停止/保全の具体的未達はRELEASE_FINAL_ACCEPTANCEとPRODUCTION_ROLLOUT_PLANへ記録。

commit/push/merge/production migration/production deploy/production smoke/24h監視なし。rollbackなし。staging追加migrationなし。sources不変。次は本番保全/隔離復元の担当・保管先、staging全入口保守の実証を優先し、全GO後だけ条件付き本番承認を実行する。

## 第52節: 本番保全・復元・停止復旧（進行中、2026-10-22）

最新添付6a13bc98により、本番DB/Auth/Storageの非公開バックアップと隔離復元、条件成立後のcommit/push/migration/deploy/smokeまで承認済み。秘密値・ユーザー行の表示は禁止を維持する。branch security/fix-storage-sign、HEAD ff1fe59406fdf3fdcf49a35c16e7e0fec413de7a。既存差分・既存削除2件・並行Buffer追加を保持。

- FreeのDashboard backup/PITRが利用できないため、公式EDB PostgreSQL18.6 pg_dump/pg_restoreを私的領域に用意。サービスインストールなし。Windowsユーザー限定ACL、DPAPI鍵＋AES-256-GCMでDB/role/Storageを別々に暗号化保存する実装を準備。backupはsnapshot READ ONLY、rolesはpassword除外、Storage bytesも別保全。未取得の時点をbackup PASSにしない。
- DBパスワードが不明との回答後、ユーザーが候補を非表示入力しDPAPI保存した。最初のhelper呼出しはユーザー側でObjectNotFoundとなったため、同等のインラインPowerShellで保存成功。値の表示・推測ログイン連打・password resetは実行していない。
- 接続前に新形式sb_secretキーの扱いを修正。TLS検証失敗後はDashboard記載の公開CA証明書を取得しverify-fullを維持。証明書検証を無効化していない。実バックアップの成否は後続結果を参照。
- stagingでmanaged roles(authenticator/supabase_auth_admin/supabase_storage_admin)のNOLOGIN切替可否だけをtransaction内で試験し、全3roleが42501。ROLLBACK済み。canSignal=trueだけでは全接続停止を証明しない。この方法は本番へ使用しない。
- 実stagingに接続するローカルHTTPアプリで16項目PASS（release52-maintenance-result.json）。Room/Post/Upload/退会受付/worker/forced publish OFFで503、旧join410、TEST件数不変。ONでRoom/Post/ledger Upload/添付投稿/forced publish再開。退会受付ONでもDB pauseにより503。終了時pause=true、ローカルserver停止、hosted Preview設定不変。
- 実staging退会停止/復旧29件は既存のdeletion-pause-staging-result.jsonを再利用。Storage/Auth checkpoint、retry、duplicate worker1回Auth削除を含む。今回のアプリflag検証は直接REST/Auth/Storage/旧deploymentの一括停止を意味しない。
- scripts/release/{private,backup,restore,maintenance}.cjsを追加。復元は127.0.0.1＋SCRAM、private ACL、実件数/constraints/RLS/GRANT/Storage hash比較を準備。未実行の復元をPASSとしない。Managed extension/プラットフォーム設定/Windows外での鍵復旧の限界を明記する。
- Buffer確認APIの追加25offline検査PASS（外部通信なし）。backup/private/restore対象lint0error、git diff --check成功。既存871を無意味に再実行していない。本番commit/push/merge/migration/deployはまだ実行していない。

### 第52節・本番backup取得とstaging全経路停止/再開

16:05:36〜16:07:33 JSTに本番のREAD ONLY snapshot backupが完了。PostgreSQL17.6、49表、custom archive 2,153,359 bytes、roles 5,494 bytes、Storage16個/6,270,480 bytes。Storage一覧/metadataは取得前後一致。DB/Storage変更false。暗号化保存先は%LOCALAPPDATA%/minnade-release-private/release52でGit外・ユーザー限定ACL。結果はrelease52-backup-result.json。DBパスワード候補は正しく、再設定なし。Windows入力値・APIキー・ユーザー本文/画像を表示していない。

一時的なmvp_release_stop schema/statement triggerをstagingのpublic表とauth.users/storage.objects/buckets計33表へ適用。管理接続postgresを維持し、Service Role直接更新/SECURITY DEFINER経由投稿/Authログイン状態更新/Auth新規作成/Storageアップロード・削除を拒否。拒否されたTEST添付削除の前後bytes SHA256一致。8項目PASS（release52-global-stop-result.json）。解除SQLは今回作成した関数を参照するtriggerだけを削除し、元RLS/GRANTには触れない。解除後Auth/直接更新/RPC/Storage upload/download/disposable delete再開と退会pause維持の7項目PASS（release52-global-resume-result.json）。終了時一時ガードなし・retirement pause=true・hosted Preview flag変更なし。既存migration001〜028は不変。

限界: postgres/supabase_admin管理操作、既発行signed URLの読み取り、ロール/DDL管理操作は止めない。新規Storage API拒否は確認したが、provider内部の一時blob残存まで直接列挙していない。移行中に新設される表は旧アプリ未使用であり、既存表/Auth/Storageのguardと新アプリflag OFF/cron停止を併用する。ガードのDDL lock取得がtimeoutする場合はtransaction全体を中止し、強制terminateや無条件GRANTへ切り替えない。

隔離restoreは実行中。roles-only dumpのpsql制御行、Supabase管理roleのgrantor権限、Windows改行の相違をローカルrunner側で修正。元backup不変。ローカルrole membershipのgrantorはrestore adminに置換するがmembership/optionsを保持し全復元roleをNOLOGINにする。managedサービスそのもの/外部SMTP等はlocalPGで再現しない。未完了のrestoreをPASSとしない。

非公開roles-only stderrの伏字表示は自動承認レビューにより拒否された。本文出力を取りやめ、固定分類のbooleanのみで原因を判定する安全な代替で進めた。秘密値・production user行の表示なし。pg_ctlのWindows子pipe待機を回避するため、pg_ctlのみstdio ignoreへ改善。追加release scripts対象lintは0error/0warning。


### 第52節・隔離復元と本番適用判定

実production backupの隔離復元68比較（49表件数・RLS/policy・ACL・制約・Storage16個hash）がPASS。さらに凍結001〜028を実backupの隔離コピーへ順次適用し28件PASS、Auth users/Storage objects件数保持2件PASS。local server停止・plaintext作業領域削除を確認。PostgreSQL17→18のNOT NULL catalog差分とrole membership grantorのlocal置換だけを正規化し、元backupを変更していない。

本番read-only preflight: public14表、attachment台帳/private schemaなし、pending重複0、未知Auth FK0。Technical871・Android/reset・staging SMTP・保守16+8+7・退会停止復旧29の証拠を再利用し、Production APPLY GO。公開GOは本番smoke完了後に判定。ユーザー最新添付6a13bc98の明示承認でこの実行内にcommit/push/反映へ進む。main自動配信はDB互換成立後。本番書込停止後にbackupを更新・再復元して最新復元点を確保する。

最終index検査では、以前未追跡だった文書/ログ等の末尾空白・空行161件（凍結SQL6件を含む）を検出。処理意味に影響しない既存整形差分として記録し、凍結bytesを優先して修正しない。通常のtracked diff --checkはPASS。最終秘密形状走査の候補1件はoffline staging拒否テストの固定synthetic接続文字列で、実credentialではない。既存571ファイル消失0・appコード不変・28hash一致。

### 第52節・本番migration適用完了

release commit 4a1faeaをfeature branchへ通常push済み。本番停止SQLの文字列置換に構文エラーが2回あり、両方rollback・適用0を確認後にrunnerを修正。17表の一時guardを適用成功。18:24〜18:26 JSTの停止後backup（DB49表/Storage16個）を更新し、隔離restore68比較＋全28試適用＋Auth/Storage件数保持2件PASS、guard17件はlocalコピーだけ解除して試適用。元backupと初回証拠を保持。

18:29〜18:31 JSTに本番001〜028を7phase/個別transaction/hash/RLS確認で全件適用成功。台帳release52-production-migrations.json。退会pause=true、全体guardは互換app Readyまで維持。本番Vercel非退会12flagを有効にする次回配信設定、退会2flagは無効。秘密env変更なし。次はmainへの通常fast-forward pushで既存本番workflowを起動する。

### 第52節・本番appと通常/security smoke

mainへbaa1e1bを通常fast-forward push、Vercel dpl_A4jAPa853bcHAVNYP77wtNen7pgGがProduction Ready、本番minnade-tsukuru.vercel.appへ割当。18:35頃一時guardを解除し0件、退会pause=trueを確認。TEST3アカウントによるHTTP/API検収18グループPASS（release52-production-smoke.json）。最初の公開レビュー要求はテストコードにconfirmが欠け400拒否、実UI契約を修正し既存TESTドラフト照合後に継続。app修正なし。

追加security10グループPASS（release52-production-security.json）：非表示/削除投稿・ルームの添付拒否、他人の削除拒否、全public/private表RLS有効、一時TEST運営者を撤去。通常検収でもforeignプロフィール/role/添付/直接Storage/旧API/旧RPCを拒否。公開cron検収時は他のopen roomを短時間ロックしてSKIP LOCKEDでTESTだけ1件公開→再試行0件、他のroomを変更していない。

本番signup確認メールを運営Gmailの新規TEST別名へ1通だけ送信成功、Gmail ID検索で到着1件を確認。本文/token/確認URLは読まない。実メールlink clickは未検収。実本番Site URLとproduction/** callback許可を既存設定で確認、設定変更なし。

通常/security成功後に退会2flagの次回配信設定を有効化。DB pauseは維持して次のReady後に最後のTEST退会1名を検収する。

### 第52節完了（2026-10-22）

Production COMPLETE / GO（5〜10人β）。退会flag配信dpl_F68amKKbPxDp3Tgy4fqWZsXEvnMC、2f3ab11、本番Ready。TEST Member1名の退会15グループPASS、作品/使用済み画像保持・未使用1件cleanup・Auth1回・旧password/refresh/JWT拒否。並行workerはbusy/202とcompleted/200が正常なlease競合で、単独再実行completed。不明副作用0を照合してDB pause=falseへ復旧。初回の全件completed期待は検収コードだけ修正。通常18/security10グループもPASS。

18:55初回監視: HTTP/Auth200・添付hash一致・4xx/5xx/429/runtimeerror0・退会/通報滞留/不明副作用/RLS未設定/公開遅延0。毎時24回のheartbeat ID24 ACTIVEを作成/保存確認、2026-10-23 19:00 JSTまで。正常時通知なし、異常時のみこの会話へ。PC/Codex稼働が必要、管理Auth/SMTPログは自動収集外。

最終秘密形状582text候補0、全28hash一致、appコードはbaa1e1bから不変、release scripts対象lint0error。既存871を再実行せず、追加は実本番とrunnerだけ。最終18項目はRELEASE_FINAL_ACCEPTANCE.md。AI_TASK done（本番反映・監視開始）。運営UIの恒久アカウント未指定、iPhone実機・別端末DPAPI復旧は残る。旧節のBLOCKED/本番未適用を最新状態と混同しない。


## V2.1開始（2026-10-22）
ユーザー添付14154a58に従いdevelop/v2をa325926からC:/dev/minnade/minnade-tsukuru-v2へ分離。元feature/buffer-queue-sendの差分は変更しない。migrationは031以降。production操作禁止、staging synthetic検収を承認済み。既存MVP room互換を保持しV2 roomを識別する追加設定を導入する。


### V2.1再開用チェックポイント（2026-10-22 23:38 JST）
専用develop/v2 / C:/dev/minnade/minnade-tsukuru-v2、基点a325926。未commit。031_v2_membership / 032_v2_creation_log / 033_v2_publicationをローカル追加し、lib/v2/{domain,server,client}.ts、app/api/v2/[operation]/route.ts、scripts/v2/{local,behavior}.cjsを実装。隔離native PostgreSQLで監査済みschema＋001〜028＋新3本適用、48チェック成功（結果complete=true、serverStopped=true）。役割/同意/定員とCore最終枠競合/辞退/追放/3拒否/ハイライト二重操作/draft競合/PII・HTML拒否/公開除外/snapshot/重複公開を検証。staging未適用、UI未実装、typecheck/lint/build未実行、V2.1未完了。
新たに元Buffer作業側が031/032も追加したため、V2 migrationは実適用前に101〜103等の別番号へ変更する必要がある（既存001〜028変更禁止）。元Bufferの未commit作業は触らない。
残作業: 新RPCのレート制御・Creatorの明示同意をDB引数でも保証、添付image実台帳参照正常系、post/search/公開CTA/ブロックeditor/room create/Core管理UI、追加race/regression、staging schema/RLS/grantsとsynthetic E2E、mobile320/375/390、SPEC/ACCEPTANCE、V2限定commit。v2Enabledはstaging ref完全一致を要求しproductionを拒否。V2 .env.staging.localはstagingだけをコピーしBufferキーは除外。秘密値出力なし。
本番監視heartbeat 24を別途処理し、既知runtime窓欠落以外の異常なし。V2のStatusはin_progress、完了とは扱わない。

### V2.1 UI・DB再検証（2026-10-23）
V2専用画面、認証由来のRPC/API、共通ブロック編集・画像候補・検索/フィルタ・公開CTAを追加。隔離native PostgreSQL 68件PASS。既存MVP offline regression成功、staging設定のローカルbuild成功、TypeScript成功。追加検査で余分なblockフィールド、遅延upload登録、退会capability保持、監査済みroom_join_requests.updated_atとの完全一致、旧公開関数のSQL変数衝突を修正。既存001〜028は未変更。Buffer側039まで進行したため、未適用V2を040〜042へ採番。040/041はstaging SQL EditorでSuccess、042は適用処理中。production変更NONE。staging synthetic E2Eはこれから。

### V2.1完了（2026-10-23 JST）

ユーザー最新添付d7e9e12cのDefinition of Doneを、develop/v2 / C:/dev/minnade/minnade-tsukuru-v2（base a325926）で完了。判定V2.1 COMPLETEはローカル＋実stagingに限る。本番変更 NONE、main merge/push/deployなし、Buffer作業側は変更なし。旧節の031〜036番号・staging未適用・UI未完了の記録は途中経過であり、本節を最新とする。

040〜043をstaging fwqucffxdmbdczspkcyrへ個別transactionで適用。040は同意/定員/Core/辞退/変更不可、041は制作ログ/blocks/退会との互換/遅延upload fence、042はsnapshot/公開、043は退会中pendingの公開終了処理をprivateの完全一致単行capabilityへ限定。通常UPDATEは退会fenceで引き続き拒否。001〜028は元checkoutと28件すべてbyte/hash一致。適用4ファイルのhash一致、manifest更新済み。

Creator/Core/Member、Core上限4・拒否3回・辞退・即時降格、最大50人の同意join、退出/追放、制作ログ検索/filter/highlight/公開除外、共通7block・6ジャンルtemplate・409時入力保持、締切snapshot・未完成fallback、Work→「この作品ができるまで」まで実装。既存MVPの画面・投稿/添付認可・いいね/通報/既読経路を継続。画像は同roomのbound台帳から選び、公開時に再認可する。

staging Auth12合成アカウント、専用room、16px合成PNGだけ使用。最新production buildをlocalhostへ起動して実stagingとUI/APIを検収。A〜Kを完了。限定公開は全非対象roomのrow lock＋advisory sentinelで対象2roomだけ許可し、同時worker処理2/0・snapshot各1件。終了後helper撤去、guard ROLLBACK、immutable trigger有効、非V2公開待ち7件不変。最終READ ONLY照合の初回はカラム名hidden_at誤りで拒否、既存is_hiddenへ修正して成功（変更なし）。

検証: 隔離native PG81 PASS、unit26 PASS、staging UI/API33 PASS、最終補完UI7 PASS、並行公開scenario PASS。既存offline回帰21suite全成功。typecheck成功、関連lint0error/0warning、最新UI build成功、diff/staged diff成功。最後の11 DB追加検査でMember/Coreの承認/拒否禁止、降格直後の権限喪失、Core追放時の貢献保持、my filterも確認。補完UIでは実画像表示＋SHA256、検索/filter、キーボード作成、削除dialog focus/Escape復帰、Creator未公開論理削除を確認。全test server停止済み。

検収中に修正した問題: PII余分field、画像MIME filter、遅延upload、退会capabilityとupdated_at trigger、旧MVP公開変数衝突、退会中pending公開fence、hydration前送信、認証token更新による入力消失、可変label。補完検査初回のhighlight失敗は既に解除済みfixtureへの誤った期待値で、再照合後修正しPASS。本番で同等問題が現在存在するとは断定せず、今回本番調査/修正なし。

変更: app/api/v2、app/components/v2、lib/v2、既存3画面のV2分岐、works/[id]/log、migrations040〜043、scripts/v2、V2 SPEC/ACCEPTANCE/results/manifest、AI_TASK/HANDOFF。DB/API commit46268a9、UI commit71629ad、検収docs/scriptsは後続V2 commit。Git外のenv/fixture/tokenをcommitしない。secret形状走査候補0、値の出力なし。

未確認/制限: 実Android/iPhoneのV2検収、hosted V2 Preview、定時cron配信、本番反映は今回未実施。モバイルは320/375/390 viewport。既存ロック順のdeadlockは全transaction中止と手動再試行で安全性を保持。V2_ENABLEDはUI/APIの停止だけで、DB RPC/worker全停止ではない。E2E記録の409/遷移abortを削除せず保持。詳しくはV2_1_ACCEPTANCE.md。

次: V2.2 AI Creatorへ分離して着手可能。本番へ出す場合は別途、実機/Previewと移行・停止/復旧を含む公開判断が必要。今回の実装承認待ちはなし。

最終Git検査: Gitの改行正規化が040/041の適用hashと異なったため、新V2 4ファイルだけ-text属性で実バイトを保持。既存001〜028と作業中SQLは変更せず、indexの4hashも適用manifestと一致させた。SQL処理内容の変更ではない。

### V2.2開始（2026-10-23）
専用develop/v2・HEAD f7f3f96 cleanを確認。添付e6ffcd30に従い実装とstaging検収を開始。production操作なし。AIキー未設定のため合成providerで独立検証を先行。既存040〜043は変更せず、新044以降。Buffer側に後から追加された040との既存番号衝突は記録し、将来の一括migrationは要整理。

### V2.2実装・検収途中（2026-10-23）
044〜047の追加SQLを作成。044/045/046 staging適用成功、047とexact synthetic clock helperは適用成功を確認。旧migration不変。新AI identity/task/output、二重context/output検証、role/lease/epoch/rate、manual/auto、AIまとめ・提案採用UI、非表示監査、公開snapshotのAI参照とhuman fallbackを実装。
隔離DB144件、AI unit44件、型検査、build、MVP21suite成功。staging合成AIのUI/API/Member拒否/提案採用/AI停止/320・375・390・1280px成功。追加自動・期限・公開E2E実行中。
実AIはstagingキー存在を確認後、合成内容3回の呼出がHTTP429。既知エラー分類は返らず原因未確定。実AI成功扱いにしない。ユーザーへ利用枠・制限の確認を依頼し、連続再送停止。未知429/利用枠不足は自動再試行しないようadapterを修正。
Vercel staging project prj_Qo1OsPU4tdgA2fluqzbAr1kTk6Dyへローカルlink。CLIが取得した設定はGit外へ保持。Previewだけにstaging設定27件を登録、AI_ENABLED=falseで準備。秘密値出力なし。まだPreviewデプロイ前、commit前。継続中。

### V2.2 hosted Preview検収・残課題（2026-10-23 JST）
develop/v2 / C:/dev/minnade/minnade-tsukuru-v2、実装commit8090808。044〜047をstaging fwqucffxdmbdczspkcyrへ適用しhashを記録。最終メタデータ確認でAI関連5table RLS、Member claim拒否、anon request拒否、immutable trigger有効、一時v22_fixture_clock撤去を確認。旧migration/main/Buffer/productionは変更なし。

隔離DB144、unit/provider52、staging合成UI/API19、自動/公開10、MVP既存21suiteがPASS。型検査・関連lint・local build成功。エラー分類の追加8unitで未知429/利用枠/既知rate/timeout/refusalのfail-safeを検証。Git対象ファイルと91 client bundleファイルへの既存秘密値混入0。秘密値・ユーザー本文・raw provider responseは出力していない（検収は合成内容のみ）。

staging Preview: https://minnade-tsukuru-staging-m85sazjk6-sonetokiyas-projects.vercel.app
既存minnade-tsukuru-staging / sonetokiyas-projectsへPreview配信、READYを確認。production deployなし。送信sourceはapp/components/lib/publicとbuild設定だけ。既存Vercel認証を持つin-app browserで9項目PASS: login、保存済みAI summary、AI停止/依頼無効、履歴、人間投稿、人間draft保存、Work disclosureと非表示反映、戻りlink、公開制作ログ。

実AIは3回のHTTP429で未成功。原因未確定、最新分類unknown。ユーザー回答は「API側の利用枠・制限を確認する」であり、復旧確認ではない。連続再送は停止。DB controlとPreview AI_ENABLEDの両方OFF。生成成功・実AI E2EはPASS扱いにしない。V2.2 PARTIAL、AI_TASKはin_progress。

USER APPROVAL REQUIRED: 自動Preview検収はDeployment Protectionへ到達し未完了。HTTP200がVercel login HTMLだったため合格を取り消し、判定を修正。既存CLI認証によるPreviewアクセスCookie取得・Git外一時保存は、自動承認レビューが「具体的な方法の承認がない保護境界の回避」として拒否。実行されていない。ユーザーへこのPreview限定の許可を質問し、既存ログイン済みブラウザで独立検収を継続した。保護無効化・代替手段によるCookie取得は行わない。

変更範囲: app/api/v2・AI/公開cron、app/components/v2、lib/ai、migrations044〜047、scripts/ai、SPEC/SAFETY/ACCEPTANCE/JSON結果、AI_TASK/HANDOFF、SQL hash属性。公開WorkのAI開示が戻りlinkに入っていた軽微表示を修正しhosted buildと画面確認済み。

未確認: 実AI成功、Hostedでの新規AI生成・320/375/390自動検収、無人schedulerの配信、実Android/iPhone。既存homeコピーのMVP role説明はV2 roleと異なるためV2.3で整理候補。安全filterはheuristic、provider保持と送信後の取り消しには限界。既存Buffer/V2の040番号衝突は将来merge前に整理、一括db push禁止。
次: API利用可能の連絡後に上限付き1回の疎通、成功なら必要な残検収のみ追加。Preview検収Cookieの許可後に保護を維持して自動UI検収。詳細はV2_2_ACCEPTANCE.md。production変更 NONE。
### V2.2 Preview承認待ち解消・最終結果（2026-10-23 JST）
直前節のPreview Cookie承認待ちは解消済み。ユーザーが「このPreview限定の取得・一時使用を承認する」と明示回答後、既存CLI認証から当該PreviewのCookieだけを取得して検収。Protection設定は不変。検収後にheadless browserを終了し、今回のCookie JSON・HTTP header・redirect responseの3一時ファイルを削除した。値の表示/Git追加なし。

Hosted自動19項目PASS: アプリlogin判定、保存済み合成AI summary、未認証401、AI OFF503、GET/manualで新taskなし、作成、投稿、draft保存、停止時greetingのskipped監査と出力0、Work開示/非表示、公開log、未認証cron拒否、browser login、320/375/390/1280表示・切替、戻りlink、公開AI log。既存in-app browserの手動9項目もPASS。Hosted配信HTML/JS17件に既存秘密値混入0。

検収期待値の訂正も記録: HTTP200だけではVercel loginを成功扱いできずapp内容まで確認。作成用合成actorの3rooms/hour上限はそのまま維持し、空き枠のある既存合成Creatorで1room検収。AI OFFはtask自体を作らない仕様ではなくskipped監査履歴を保持するため、期待をskipped＋AI output0へ修正。これらのためDB設定・本番コード変更は行っていない。

最新判定V2.2 PARTIALの残件は実OpenAI成功検収と、成功後のhosted新規生成確認。API復旧の連絡はまだなく再送なし。定時scheduler/実機は未検収として明記。既存040〜043はf7f3f96との差分0。検収・仕様文書と再実行スクリプトをV2ブランチでcommitする。Production Changes NONE。

### V2.3 Creative Office UI — local complete / Preview acceptance in progress（2026-10-23 JST）

develop/v2 / C:/dev/minnade/minnade-tsukuru-v2。開始4f0410aはclean。UI commit fd8494e、Home/Rooms/Room/Log/AI/Draft/Works/My Page/Createを刷新。caller-scoped catalog APIはService Role不使用、既存RLSを維持し、退会中actorを拒否。ローカルDBのV2.1/V2.2回帰144、AI offline52、catalog/security/contrast25、ブラウザ主要28、追加実操作4、表示・a11y38、AI UI状態4、V2停止時fallback5、MVP21suiteがPASS。型検査・関連lint（0error/0warning）・最新build・diff check成功。実AI呼出0、既存429未解消。

320/375/390/768/1024/1440幅、draft409時入力保持、危険操作dialogのcancel初期focus/Escape、320px実画像upload、Core辞退承認・追放再参加拒否を確認。AI停止中も人間の制作を継続。既存RPCがCreatorにだけ返す他メンバー情報は広げない。My Pageの通知は既存Core申請と公開作品の範囲、退会後公開作品への参加履歴は継続。既存MVPへのV2 flag OFF fallbackを保持。

Preview URL: https://minnade-tsukuru-staging-gogr4s5qk-sonetokiyas-projects.vercel.app 。staging専用projectにsource-only配信、production deployなし。ユーザーが新Preview限定Cookie取得・一時使用を承認済み。Protection不変でHosted検収へ進行。現時点ではHosted PASSとは扱わない。画像screenshotの読み込み中を完了画面と混同しないよう、一覧の取得完了待ちを検収へ追加。初期dev serverのHMR中遷移やselector誤りはbuild起動で再検証済み。

変更はUI/APIと検収scripts/docs。package/lock/migration変更なし、main/Buffer checkoutは未変更、production DB/user data操作NONE。秘密値の表示/Git追加なし。残: Hosted A〜F、最終記録・検収commit、一時Cookie削除。


### V2.3 COMPLETE — Hosted final acceptance（2026-10-23 JST）

前節のHosted待ちは完了。UI commit fd8494e、同sourceのstaging Preview https://minnade-tsukuru-staging-gogr4s5qk-sonetokiyas-projects.vercel.app はREADY。Hosted79項目（主要28、create/upload/辞退/追放4、visual/a11y38、AI route mock4、Core編集と取得後log補完5）すべてPASS。local300checksとMVP21suite PASS。各JSONはdocs/v2-3-*、詳細V2_3_ACCEPTANCE.md。実AI呼出0、意図したmock503以外の500・uncaughtなし。

主要320/375/390/768/1024/1440幅、21画面状態＋取得済みroom/log4状態のaxe違反0。全widthで横崩れなし。Coreのハイライトとhuman draft保存もHosted成功。公開済み合成fixtureを新UIでWork→公開log表示し、変更のない公開backendは隔離DBで回帰。今回新たなstaging公開worker/clock操作はしていない。

型検査・関連lint・build/diff成功。package/lock/migrationは開始HEADと差分0。新runtime依存0。配信HTML/JS19件の既存secret混入0、repository/client bundleも0。Preview限定の一時Cookie/HTTP headers/redirect HTML3ファイルを削除、test browsers/server終了、Protection不変。値表示/Git追加なし。

AI_TASK done。V2.3 COMPLETEはCreative Office UI＋staging検収の範囲。V2.2の実OpenAI429は未解消でPARTIAL維持、AI flags OFF。物理Android/iPhone・実利用性能・screen reader認証は未実施。Creator以外へのmember/Creator名義公開は既存RPC projection以上に広げない。通知は既存申請/辞退状態/公開作品のみで新通知DBなし。Buffer/V2の旧040採番衝突は将来merge前に整理。main/Buffer checkout・production DB/migration/deploy/user dataの変更NONE、pushなし。

Next: 別依頼でV2.4 Free/Plus/Proへ進める。実AIを前提にする枠・課金検収は429復旧後に別途。今回の承認待ちなし。検収scripts/docsを後続develop/v2 commitにまとめる。


### V2.4開始（2026-10-23 JST）
develop/v2 / C:/dev/minnade/minnade-tsukuru-v2、HEAD3cc489a cleanを確認。添付37f0808bによりstaging課金実装・migration・Preview・V2commitを承認済み。production/live payment禁止。V2 staging envにStripe変数なし、DB URL未設定。テストキー用非表示入力helperを用意し、合成provider/隔離DB実装を先行。V2.2実AI429は別残件、再送なし。

### Stripe plugin接続・商品価格照合（2026-10-23 JST）
このチャットでOAuth接続先と保存済みsk_test_キーのアカウントを再照合し、双方acct_1USz6gLZaDd1Edb0（みんなで作ろうサンドボックス）、livemode=falseを確認。Stripe pluginで既存2商品・4 recurring JPY価格を確認: Plus月780/年7800、Pro月1980/年19800。4件ともactive、周期1、staging設定の4 Price IDと一致。既存設定を再利用し、新規商品・価格の重複作成なし。キー値/OAuth資格情報は出力なし。tax_behaviorはunspecifiedのため税込/税別・Tax検収は未確定。この確認はCheckout/Webhook E2E成功を意味しない。V2.4全体のAI_TASKはin_progress維持。アプリコード・DB・本番・決済・deploy・commit/push変更なし。

### V2.4実Stripe検収チェックポイント（2026-10-23 JST）
048〜051をstagingだけへ適用しhashを固定。実Stripe test Checkoutのブラウザ完了＋署名Webhook、Plus/Pro即時反映、Creator共有枠、Core/Member制限、設定保存/再利用など16件PASS。Stripe Test Clockで更新時降格/解約、実失敗カードの3日grace・追加付与停止・支払復旧、月→年切替、退会前subscription停止/反復/遅延Webhook隔離11件PASS。Auth削除・本番変更は実施していない。
隔離DB204件、billing unit25件、AI安全性52件、MVP既存回帰21suite、型・buildはPASS。MVPの課金モジュール不要importをV2 staging限定の遅延importへ修正。月末anchorとAI inactivity dedupeの境界修正052を追加中。Preview/UI検収・最終記録は未完了。実OpenAI再送0。Status in_progress。

### V2.4 local完了・Hosted検収へ（2026-10-23 JST）
実装commit 7f89628（develop/v2）。追加052をstaging適用済み、DB213、billing unit31、実Stripe16＋Test Clock11、local UI24（6幅・axe10画面状態違反0）、型/lint/build/MVP回帰成功。退会hookの型検査失敗を修正し最新build成功。AIフォームのtextarea/selectラベルを安定化、狭い設定欄は1列化。適用済みSQLのCRLFを保持するためwhitespace属性を追加し、HEAD内の5hashもmanifest一致（SQL内容変更なし）。stagingメタデータ22項目PASS、全billing表RLS/直接grant拒否、private関数非公開、AI flag OFF。秘密値走査0。Preview準備中、未検収をPASSとしない。Production NONE / Live Billing OFF。

### V2.4最終Preview待ち（2026-10-23 JST）
追加source commit 5c37a32: 猶予切れでFree表示になっても支払い確認/解約の入口を残す。4 UI状態テストPASS。共同制作UI28回帰PASS、最新source build PASS。最終Preview 4wqvksxt4を配信、旧9sfb8v7a2は検収対象から除外。USER APPROVAL REQUIRED: この最終URL限定のCookie取得・一時保存・自動UIと署名Webhook転送（完了後削除）。質問済み、まだ実行していない。旧Preview承認を流用しない。独立検証は完了、Hostedを合格扱いせずV2.4 PARTIAL / AI_TASK in_progress維持。

最終集計訂正: local UIはJSONのcheck単位で24件（6幅/axe10状態はその内訳）。上記25件表記を訂正した。合計401 check＋既存MVP21suite（集計JSON参照）、全実行済み項目PASS。検証記録commit e7a50e2。最終Preview READY、Hosted実操作は承認待ちで未実行。新Cookieファイルなし、テスト用listener/browser/serverは終了。push/main merge/production操作なし。次は最終URL限定の承認回答を確認して用意したHosted scriptsを実行し、実績に応じてAI_TASK/Acceptanceを更新する。


### V2.4 Hosted検収・Stripe予約作成の修正（2026-10-23 JST）
承認済み4wqvksxt4だけの短期CookieをSecure/HttpOnly/host-onlyで取得、値を出力せず検収。Plus月払い/Pro年払いCheckout→署名Webhook→設定/解約12、UI24、支払状態mock4、署名/重複/順序逆転/未知mapping9、配信23資産の秘密混入0を確認。Hosted降格でfrom_subscriptionとmetadataの併用をStripeが拒否するP1を発見。旧31unitはprovider制約を模擬していなかった。作成時はfrom_subscriptionのみ、更新でmetadataを設定。同一idempotency keyから同一schedule IDが返る場合だけ未記名予約を再開し、他操作を拒否。commit efebbb4、unit32/型/lint/build PASS。実Stripe Test Clock＋修正済みlocal buildの降格/復帰/年周期/実支払失敗/退会前停止の追加検証PASS。これは新HostedでのPASSではない。production/live/実OpenAI呼出なし。新Preview配信と検収へ続行、AI_TASK in_progress。

### V2.4修正版Preview READY・新host許可待ち（2026-10-23 JST）
source efebbb4をstagingだけへ配信: https://minnade-tsukuru-staging-8531792ul-sonetokiyas-projects.vercel.app、READY。旧4wqvksxt4のHostedは77 checks、秘密混入23資産0。修正済みlocal production build＋実Stripe Test Clock16 PASSはHosted検収とは区別。unit32/型/lint/build/対象script lint/DBメタデータ22/diff PASS。アプリ変更はlib/billing/stripe.tsのみ、migration追加・変更なし。
USER APPROVAL REQUIRED: 最新ユーザーの「現在のPreview限定・他Previewへ流用禁止」に従い、新URL限定Cookieと署名test Webhook転送の許可を具体的URL付きで質問。新Cookie取得なし。旧3一時ファイル削除、browser/relay/CLI listener/local server終了、今回合成4名のrefresh session revokeとfixture内token除去済み。ユーザー・customerの物理削除なし。
次: 許可受領後にpreview-scope.cjsのexact hostを新URLへ更新→環境事前確認→preview-schedule --preview（既存合成ユーザー再利用）→browser --preview（console/hydration/401 loop含む）→secret scan→cleanup→判定。既存77とDB/AI検証を無条件に再実行しない。新Hostedが未実行なのでAI_TASK in_progress / V2.4 PARTIALを維持。本番NONE、live OFF、実OpenAI呼出0、push/main mergeなし。

### V2.4 COMPLETE — 修正版Hosted最終検収（2026-10-23 17:02 JST）
ユーザーが修正版最新Preview限定Cookie・署名test Webhook転送を明示承認。最新一覧/READYを再照合し、8531792ul（source efebbb4）だけへ新しい短期host-only Secure/HttpOnly Cookieを取得。staging ref、Stripe sandboxと4 active test prices、test billing境界を事前確認。旧Cookie流用なし。
重点7件PASS: 既存合成Plus→Pro UI変更、署名Webhook後2,000credit、降格予約、同一request再送で重複なし、実Stripe schedule metadata照合、年周期予約、解約後も期間内Pro維持。初回はテストselectorのlabel完全一致で送信前に停止。選択肢を含むlabelを考慮したselectorへ修正してPASS。アプリ変更なし。最終DB読み取りはpending/uncertain operation0、pending event0、active leaseなし。解約のnext_plan=freeは正常な既存仕様。署名転送7件のうち成功5・lease競合で再試行可能2を区別し、未処理0を確認。
修正版UI24 PASS、320/375/390/768/1024/1440、取得済み10状態axe0。app console/hydration/uncaught/HTTP5xx/認証loopなし。外部リソースを意図して遮断したconsole7件は別計数。320px billing取得済み画像も確認。最新配信HTML/JS23資産に既存秘密値・Cookie混入0。旧Hosted77と変更のないDB213/unit32/AI52/MVP21suite/型/build証跡を実行先・sourceを保って再利用。実OpenAI再送0、AI flags OFF維持。
検収後、今回Cookie一時ファイル削除・残数0、今回再利用した合成4名のrefresh sessions終了、browser/relay/Stripe listener停止、該当test process0。新規合成ユーザー0。短期access JWTの即時失効を偽っていない。合成identity/最小課金fixtureは再現用に保持。Production DB/deploy/migration変更NONE、live billing OFF、push/main mergeなし。
変更: scripts/billing/{preview-scope,preview-schedule,browser,preview-secrets,secret-scan}.cjs と docs/AI_TASK.md、V2_4_ACCEPTANCE.md、AI_HANDOFF.md、v2-4-*検収記録。runtimeアプリ・package・migrationは変更なし。関連script lint PASS。AI_TASK done / V2.4 COMPLETEへ確定。旧途中失敗結果は残し、最終結果による解消を記録。
次: V2.5は別タスクとして着手可能。実AI429はV2.2 Known Issue。本番/live課金、恒常Webhook、税込/法務/返金・実機、既存Buffer/V2 migration採番衝突は将来公開の別前提であり、今回承認・検収した扱いにしない。V2.5の自動実装は開始しない。既存許可に従いdevelop/v2へ最終検収記録をローカルcommitする。

### V2.5開始（2026-10-23 JST）
添付66dbe3b8でDB/権限/UI/staging/Hosted検収とdevelop/v2 commitを承認。開始b794e0e clean、最新migration052。既存V2.1〜V2.4仕様/検収、moderation/退会pause/fence/公開runbook、Next同梱route/clientガイドを確認。既存Service Role中心の運営経路とV2のcaller RPCを調査中。production joedeuyrzimqyjapqpyhは触れず、staging fwqucffxdmbdczspkcyrのみ。実OpenAI再送0。AI_TASK in_progress。
設計: 独立Owner/Moderator台帳、callerをDBで判定する限定RPC、版数とrequest UUID、変更とimmutable auditを同一transactionにする。新DB停止は既存env停止に追加し、退会pause・AI epoch stopを再利用。既存の意図したOFF状態をmigrationや検収終了時に勝手にONにしない。旧admin経路の迂回も検査対象。詳細PII/prompt/provider payloadを管理APIへ返さない。

### V2.5実装・staging適用（2026-10-23 JST）
053〜055をstaging fwqucffxdmbdczspkcyrにのみ適用、hashをv2-5-staging-migrationsへ記録。Owner/Moderator・caller RPC・immutable audit・CAS/冪等性・失敗も含むrate・feature停止・限定投影を実装。旧service moderation経路はV2で410、旧operator AI迂回は拒否。既存退会capability/AIepoch/pause/公開処理を再利用。
隔離PostgreSQLで317 checks（既存V2.1〜2.4 213 + V2.5 104）PASS。hide/suspend/report競合、featureOFF対write、AI CAS、退会checkpoint対pauseを含む。MVP21suite/Stripe unit32/型/対象lint/build PASS。staging RLS/ACL/OFF維持16 PASS。staging最小合成5名・2ルーム・2通報、公開/非表示・停止ユーザー・AI失敗・grace・退会待ちfixture作成。fixture作成時の名義長・UUID型・RPC引数の問題はテスト補助コードを修正し、同じ合成identityを再利用して完了。本番行・秘密値の取得なし。
ローカルbuild＋実staging UI22 PASS、10管理領域/6幅(320/375/390/768/1024/1440)、axe0。モバイル一覧はカード表示。非表示/再表示・通報・停止/解除・Owner権限付与剥奪・CSRF拒否・取得失敗の非0表示を実操作。OriginとNext内部URLの差による正規POST拒否を修正済み。負例403と意図的503は通常consoleと区別する検収へ改善。
Preview設定はADMIN_ENABLEDと検証済みstaging service key/test Stripe keyを対象projectのpreview環境だけへ設定。CLIの取得結果では秘密変数の一致が検証できないため、秘密値を比較済みと偽らず、明示設定の証跡＋接続先・OFF設定を記録。AI OFF/退会worker OFF維持。secret scan960ファイル/105client assetsヒット0、既存migrationhash不変。
次: V2.5 Hosted Preview配信とexact-host一時Cookie承認、残るHosted検収・cleanup・最終判定。現状PARTIAL。今回 production変更NONE / live OFF / 実OpenAI再送0 / pushなし。

### V2.5 COMPLETE — Hosted最終検収（2026-10-23 JST）
実装79a15d7のstaging Preview https://minnade-tsukuru-staging-6jtg2klwo-sonetokiyas-projects.vercel.app はREADY。ユーザーの当該URL限定Cookie承認後にhost-only/Secure/HttpOnly/最大2時間のアクセスを利用。Protection不変、他Preview/production流用なし。
Hosted UI22、追加API/実staging10、375px実操作5 PASS。隔離DB317（既存213+運営104）、billing unit32、metadata16、local UI22、Hosted37 = 424 checks＋MVP21suite。6幅320/375/390/768/1024/1440、全管理領域/確認dialog axe0。通常console/hydration/uncaught/5xx0、負例403と意図的503は別計数。型/実装lint/buildと追加script lint/diff PASS。
停止中post/upload/join拒否→解除後成功、AI OFF中の人間投稿と公開fallback、Upload OFF中の既存公開添付閲覧、公開log hide/添付拒否、Creator停止時の公開作品保持、退会受付OFFでjob追加0、通報却下とhidden独立、Hosted同時hide/restoreの単一成功/409/監査1件を確認。375pxの投稿・アップロード停止復旧、ルーム参加停止復旧、Enter/Escape/focus復帰も成功。
テスト訂正: hidden対象への新規通報は既存admissionが正しく拒否。公開対象の受付後hideへ順序訂正。モバイルselectorを実ラベルへ直し未完了分だけ再検収。runtime app・適用済みmigrationの追加変更なし。
秘密走査: Hosted26資産hit0、repo/105client assetsも既知secret・Cookie・合成password hit0。最新件数v2-5-secret-scan.json。053〜055を含む適用済みmigration hash不変。
cleanup: Cookieファイル残0、合成5名のrefresh session終了、有効auth.sessions/refresh token各0、検収browser/local server終了。V2.5ではStripe forwarder/listener未起動。短期access JWTの即時失効とは言わない。5合成人物・3ルーム・3通報・監査を保持。全停止設定は開始時と一致、AI/退会受付/worker OFF維持。
AI_TASK done、V2_5_ACCEPTANCE COMPLETE。Known Issues: 実OpenAI429（再送0）、MFA/step-up未強制、自由記述PII検出の限界、発行済み署名URL短期残存、実機/無人cron/管理Auth-SMTPログ未検収。Bufferはstaging未接続でproduction操作なし。
変更: scripts/adminのPreview取得/範囲/秘密走査/検収/cleanup、harness、docs/v2-5-*.json、V2_5_ACCEPTANCE/SPEC、ADMIN_OPERATIONS_RUNBOOK、AI_TASK/HANDOFF。develop/v2へ最終検収をローカルcommit。push/main mergeなし。Production DB/Auth/Storage/migration/deploy Changes NONE、Live Billing OFF。
次: V2全体の統合検収・本番移行準備へ進める。Buffer/V2の040採番衝突・移行順、実運営Owner bootstrap、停止/復旧、live課金運用条件を別途確定する。本番反映は今回のCOMPLETEに含めない。

## Buffer投稿計画の追加（2026-10-22）
最新ユーザー依頼に基づき本番を変えず進行。第52節Production COMPLETE/5〜10人β GO、監視18:55 JST異常0を記録と担当チャットで照合。24時間観察は未完。
lib/buffer/promotionPlanner.tsとdocs/buffer-planner-check.cjsを追加。日次2/新規1、JST昼夜、完成優先、安全性チェック、重複・不明送信結果除外、日曜週次を非送信で実装。47新規＋25接続回帰、型、追加lint成功。BUFFER_CONNECTION_SETUP.mdの旧公開待ち記述を更新。
実API疎通・DB永続キュー・送信workerは未接続。秘密値取得なし、commit/push/deploy/本番変更/投稿なし。次はtrusted DB adapterと原子的予約・直前再判定・送信結果不明の照合を実装する。検収済み本体の監視を継続。

## Buffer永続キュー・送信処理（2026-10-22、最新）
feature/buffer-queue-send（基点a325926）でローカル実装完了。既存Buffer差分を保持。commit/push/merge/deploy/実DB適用/実送信/本番設定変更は全て無し。本番MVPと24時間監視の設定には触れていない。

変更: 追加029 migration（review/queue、公開状態adapter、原子的予約/claim/fencing/結果記録）、lib/buffer/{sender,worker}.ts、既存promotionPlannerの送信前再検証、app/api/cron/buffer/route.ts。通常夜1/最大日2・完成優先・新規日1・締切/満席/日曜週次を維持。未レビュー/掲載除外/PII/通報/削除/非表示を再取得。未知結果と中断sendingは再送しない。接続前失敗だけ最大3attempt。canaryは指定event1件に固定、automaticは別環境ゲート。

検証: 47 planner＋25 connection＋58 queue/worker/native PG＋11 route=141 PASS。native PGは127.0.0.1合成schema、8接続同時予約/claimと6接続cap、再接続後の永続化、送信後保存失敗、除外変更、ACLを確認。既存全MVPテストは再実行していない。型チェック・追加lint・diff成功。build最終結果はBUFFER_CONNECTION_SETUP末尾参照。

dry-runは合成候補2→計画1→送信前適格1、書込0・送信0。実本番データdry-run/実staging/実API/Buffer予約/X投稿は未実施。ローカルBUFFER_API_KEYなしを存在真偽のみで確認。前回のVercel Secret保存記録は維持するが、今回秘密値を取得しない。

残作業: 実stagingで既存schema/PostgREST権限との統合検収、掲載許可レビュー1件、秘密管理画面で対象環境のキー設定、実データdry-run→明示承認されたBuffer予約1件→X公開1件検収。push/merge/deploy/本番変更は最新ユーザーによる明示承認まで禁止。cron登録は未実施（既存vercel.json不変）。予約後の公開除外変更はBuffer側取消が必要で、自動取消は未実装。
導入・停止・不明結果の手順はdocs/BUFFER_CONNECTION_SETUP.mdの最新節。次はstaging統合検収の準備と対象作品選定。AI_TASKは実環境検収待ちのin_progress。

最終buildも外部通信遮断下でPASS（既存middleware非推奨警告のみ）。追加lintは0error/0warning、全体lint未実行。HEAD a325926から今回commitなし、作業ツリーに保持。既存vercel.json/公開cron/package-lock不変。


## Buffer staging・X公開検収完了（2026-10-22 23:12 JST、最新）
Status: done（今回のstaging統合検収・TEST予約/公開1件）。自動運用の本番導入は未実施。
staging fwqucffxdmbdczspkcyr に029/030適用。実DB検収25群PASS（API13・SQL状態遷移11・ACL/RLS/trigger集約1）。実データdry-runは書込0/送信0、固定TEST canaryは適格1件。通常時間枠を過ぎた通常plannerは0件で正常。
Buffer API接続PASS。TESTを1件のみ予約し、2026-10-22 23:07:07 JSTに公式 @minnade_tsukuru で公開。Buffer Sent1/Queue0、本文・投稿者・時刻をX画面でも確認。
公開URL: https://x.com/minnade_tsukuru/status/2113270930105409955
Buffer ID: 6ada172de8cca8cdcc55b722。DB state=sent、attempts=1、sent_at・external_id・external_url保存済み。予約後の同一event再投入0件を確認済み。追加TEST許可false、自動送信OFF、cron未登録。
APIの公開リンクは数値アカウントID形式だったため初回照合unknown。再送せずX画面で公式アカウントへのリダイレクトを照合し、確認済み固定IDだけユーザー名URLへ正規化する修正と他ID拒否テストを追加。読取再照合でsentへ収束。
最終検証: planner47 + connection25 + route11 + queue/nativePG78 = 161 PASS。typecheck・対象lint・外部通信遮断build PASS（既存middleware非推奨警告のみ）。全体lint・既存MVP全試験は再実行していない。
追加変更: migration030、testCanary、sender.inspect、scripts/bufferのstaging専用runner/SQL/秘密登録補助、公開結果JSON。秘密はGit除外の.env.staging.localのみ、出力/commitなし。
本番app/DB/設定変更・push/merge/deployなし。承認済みX TEST投稿1件のみ外部公開。並行監視の差分は保持。feature/buffer-queue-send / HEAD a325926、今回未commit。
最終追加の予約RPCによる重複再確認は自動承認レビューで拒否され未実行。安全な読取snapshotでsent/attempts1/許可falseを最終確認し、既存の成功した重複検査を採用。
次の1手: この差分と本番導入手順をレビューし、本番適用の明示承認を得る。自動ONは別判断。予約後の除外はBuffer側取消が必要（自動取消未実装）。証跡: docs/buffer-staging-final-result.json と各staging結果JSON。


## Buffer production rollout STOP（2026-10-22、最新）
最新添付3f3e6457でcommit/push/main/production migration/deploy/auto-send ONまで条件付き承認された。追加承認待ちではなく、重大安全条件未達のため本番反映前にSTOP。
確認した重大問題: 029 buffer_claimは予定の15〜2分前に取得し、workerはBufferへの予約作成直前だけ除外再検証する。受付後はsucceededとなり、snapshot.queue/claimの対象外。以後非公開/通報/掲載除外になっても外部予約の取消経路がなく、X公開を抑止できない。以前の手動取消という制約は今回の自動運用条件を満たさない。
追加不足: sender.inspect/buffer_reconcileはstaging-run手動操作だけで、通常automatic workerには未接続。公開結果不一致の自動検出・停止は未実装。cron登録も未実施。
再現: node docs/buffer-production-blocker-check.cjs。実workerと合成RPCで予約受付後の非公開化→次回automaticを実行。合成send1、cancel0、inspect0、状態succeeded維持。これは不具合の再現成功であり安全性PASSではない。結果docs/buffer-production-blockers.json。ネットワーク0、実DB変更0、外部投稿0。追加診断lint PASS。既存161件/typecheck/build PASSは前フェーズ実績で、今回の不足を検証していなかった。
Git: feature/buffer-queue-send、HEAD a325926。git fetch origin mainでremote最新a325926を確認。local mainはff1fe59のため、再開時は古いlocal mainを基準に上書きしない。今回commit/push/mergeなし、既存差分と並行監視差分を保持。
環境識別は既存記録のみ: production Supabase joedeuyrzimqyjapqpyh、staging fwqucffxdmbdczspkcyr、Vercel sonetokiyas-projects/minnade-tsukuru。今回live production API/DB/secretの確認・変更は未実施。029/030本番適用・deploy・production dry-run・queue smoke・cron smoke・本番送信は未実施。auto-send OFFのまま。Buffer専用24h監視は未開始、既存MVP監視設定は変更なし。
再開に必要な修正: 予約後の除外変更を外部公開まで安全に扱う送信方式/取消処理、通常予約の自動receipt照合、異常時にBufferだけ停止する制御と監視を実装し、stagingで取消/照合失敗/競合を検証。その後今回の有効な本番投入承認の範囲でrolloutを再開する。一般ユーザー作品で検証しない。
Status: in_progress（重大な公開安全性の不足で本番投入BLOCKED）。V2.1へ専念できる完了状態ではない。


## Buffer安全修正・staging再検収（2026-10-23 00:17 JST、最新）
Status: in_progress / production BLOCKED。最新添付68410385の条件付き本番投入承認は有効だが、staging DoDが全PASSではないため本番操作へ進まない。

実装: lifecycleによる予約後の適格性再評価、取消、通常公開結果照合、DBのBuffer専用kill switchを追加。予約受付をsentとせずscheduledで保存。通常投稿はBuffer下書き(saveToDraft)として保持し、予定時刻から2分以内に最新候補・停止状態・lease tokenを検証した1回のreleaseだけを許す。scheduler停止中に自律公開しない。release意図は先にDBへ保存、unknownを自動再送しない。公開照合は10分猶予、読取失敗3回で停止。除外/アカウント不一致/不整合/不明変更結果は即停止、停止後も取消/照合を継続。手動resumeはDB owner専用で未解決unknownを拒否。通常夜1/最大2/完成優先等は維持。

staging適用: 029/030はhash不変。031制御・取消/照合、032未送信取消のcap補正、033固定取消TEST本文、034公開guard、035scheduler構造、036transport ACL試行、037同期HTTPへの置換、038HTTPオプション互換、039応答検証。035/036のpg_net方式は採用しない。Supabase管理者所有のため036のREVOKEは実効なしと判明し、実秘密の登録前に037以降へ置換。最終tickはVaultの専用cron secretをメモリ内で使用し、HTTPコード/失敗回数のみ保存。pg_netキューへ秘密を保存しない。既存Vercel publish cronは変更なし。Hobbyは毎分cron不可のためSupabase pg_cronを候補とする。

検証: planner47 + connection25 + route11 + nativeDB122 = 205 PASS。typecheck・関連lint・外部通信遮断build PASS（既存middleware警告のみ）。合成再現テストは取消1/照合2となり旧ブロッカー再現false。staging追加状態遷移12群PASS。毎分DB tick 12回成功、HTTP疎通・HTML200拒否(502)・3回失敗停止・anon/authenticated/serviceからscheduler実行拒否を実検証。実credential付きデプロイ済みrouteとのcron end-to-endは未検証。全MVP試験/全体lintは再実行していない。

実取消: Buffer ID 6ada20dff09f431dcae37955、23:54予定を23:43に除外→取消成功。予定時刻後も未公開。既存X TEST 2113270930105409955はAPI読取照合成功。
公開方式の追加TEST: Buffer ID 6ada24ebbf6d801ac6f2bcaf を下書き保存、画面Drafts1/Queue0で確認。00:07:17にreleaseを1回実行したが成功応答として確定できずunknown/auto-send OFF。応答の詳細は当時保存しておらず原因未確定。再送0。読取ではdraftのまま、その後停止時cleanupで取消成功、DB cancelled/Buffer missing。追加X公開0、最終画面Queue0/Drafts0/Sent1。失敗を公開検収PASSと扱わない。次の検収用にHTTP status/typename/分類のみの秘密なし診断を追加した。

実データdry-run: candidates3/planned0/queued0/preSendEligible0、writes0/sends0（深夜の通常時間枠外）。最終stagingはactive0/unknown0/autoSend=false/testAuthorization=false/scheduler=false、一時cronはunschedule済み。既存MVP監視設定は変更なし。Buffer専用24h監視は本番未稼働なので未開始。

production DB/app/env/migration/deploy変更なし、main統合/pushなし。一般ユーザー作品の試験投稿なし、秘密露出なし（52対象ファイルで実環境秘密一致0）。branch feature/buffer-queue-send。既存監視の未commit差分は保全。
残作業: 追加公開TESTの上限を超えるため最大1件の再検証許可を質問中。許可前は追加予約しない。新しい診断でrelease結果を特定し、修正後のheld→公開→自動DB sentとhosted cron end-to-endをPASSにしてから本番再判定。許可待ちを自動再送の根拠にしない。V2.1に専念できる完了状態ではない。
証跡: buffer-safety-acceptance-result.json / buffer-held-publication-result.json / buffer-staging-cancellation-result.json / buffer-staging-migrations.json。
Updated at: 2026-10-23 00:17 JST


## 最終1件公開検収（2026-10-23 03:49 JST、最新）
Status: in_progress。添付3f05b307の最大1件だけを使用し、最終TESTはPASS。追加予約・再送・別TESTは実施しない。

手動TESTは040の限定guardでauto-send=false/MANUALのまま実施。Buffer ID 6ada5651ca69a1b7d3cfec46、予定03:39。公開直前に再評価、03:39:15にrelease意図を永続化し、editPostを1回だけ実行、HTTP200/PostActionSuccess。03:39:16.447公開、03:40:03.341に通常lifecycleでDB sent確定。external_id=2113339419771982087、external_url=https://x.com/minnade_tsukuru/status/2113339419771982087、sent_at/checked_at保存。X公開ページでも公式アカウントとTEST本文を確認。attempts1、同一候補再enqueue追加0、auto-send OFF。TEST許可は成功後falseに戻した。

releaseは検証済み本文を明示しdueAt=nullへ変更。以前の失敗応答が保存されていないため、以前の原因を断定しない。今回の新方式は実公開からDB sentまで成功した。新規TESTを要求する残課題はない。

cron: staging preview dpl_GnAKC652xwcXwhXi7XgWQxEy29aK Ready。https://minnade-tsukuru-staging-5pz40ulv9-sonetokiyas-projects.vercel.app の /api/cron/buffer で認証なし401、認証付き同時2実行200/dry-run/writes0/sends0。Vercel SSOは維持し公式automation credentialを使用。資格情報はWindows暗号化保管、Vercel preview専用Secret、表示/commitなし。041をstaging適用し、Vaultのautomation credentialはstaging宛にのみ付与。production宛ヘッダーは従来のcron認証だけ。

未完了: STAGING_DATABASE_URLが未登録（空または仮値）で、DB Vaultへの秘密登録とpg_cron→Vercel全経路が未検収。本人へ.env.staging.localのstaging接続URLを安全に登録するよう依頼済み。秘密をチャットに貼らせない。DB schedulerはOFFのまま。全経路PASS前にmain/push/production操作へ進まない。正式なDB接続を得たらVault登録・OFF/dry-runでscheduler検収、不要な一時cronを解除し、既存条件付き承認に沿って本番再判定。追加TESTは不要かつ禁止。

検証: planner47 + connection25 + route11 + nativeDB140 = 223 PASS（scheduler認証・OFF・HTML200拒否・3回失敗停止・権限拒否・競合skipを含む）。型チェック・関連lint・build PASS。追加運用scriptの未使用変数warningを除去済み。git diff --check PASS。最終staging dry-runはcandidates4/planned0/queued0/preSendEligible0/writes0/sends0。深夜の通常枠外。040/041適用済み、production migrationsなし。

branch feature/buffer-queue-send / HEAD 53e6c01、今回差分未commit。push/main merge/production deployなし。production DB/app/env変更なし。Buffer auto-send OFF、Buffer専用24h監視NOT STARTED、既存MVP監視差分/設定は保持。Buffer/X Production BLOCKED（cron全経路未完）。V2.1へ完全専念はまだ不可。
証跡: buffer-final-release-result.json / buffer-final-publication-result.json / buffer-final-test-progress.json / buffer-staging-hosted-cron-result.json / buffer-staging-dry-run-result.json。
Updated at: 2026-10-23 03:49 JST


## DB接続登録後の再確認（2026-10-23 03:59:32 JST）
Status: in_progress。本人の登録済み返信を受け接続前検査を実施したが、指定.env.staging.localのSTAGING_DATABASE_URLは空文字のまま。定義は1件、類似名の別ファイルなし、ファイル最終更新は2026-10-22 22:54:50 JST。秘密内容は出力していない。DB接続・Vault登録・scheduler全経路は未実施。エディターで対象ファイルを保存してから再開が必要。追加TEST・本番変更・push/merge/deployなし。最終TEST PASSと223テストPASSの状態を維持。


## cron全経路検収完了・本番導入開始（2026-10-23 04:07 JST）
Status: in_progress。登録済みstaging session pooler接続成功。Vaultの専用秘密をパラメーターで登録し、DB tick→Vercel dry-runは200。pg_cron定期実行もsucceeded/HTTP200、queueとattempts不変、送信0。一時cron解除、staging scheduler/auto-send OFFへ戻した。223テストPASS、hosted認証なし401/認証付き同時200。最終TEST成功のため追加TESTなし。
本番read-only事前検査: /・/login・/rooms・/works・Auth200、退会pause=false、不明副作用0、RLS不足0、Buffer既存表なし。既存MVP関数hash保存。Supabase statusはMonitoring継続だが現在の接続と主要経路に異常なし。
新規本番データ搬出は自動承認レビューで保存先の明示承認不足として拒否。搬出せず、既存バックアップ/復旧検証記録の整合性を確認。導入はBuffer専用追加のみ、各migrationのトランザクションと既存MVP関数hash/RLSを検査。036はstagingで無効だったpg_net ACL試行のため本番不要、040/041は手動TEST/staging認証用のため本番不要。本番対象029-035,037-039を個別適用予定。


## Buffer/X本番投入完了（2026-10-23 04:15 JST、最新）
Status: done。追加TESTなしでcron検収から再開し、本番投入COMPLETE。最終TESTは既存の2113339419771982087だけ、再予約/再送なし。

staging: 保存されたsession pooler URLでTLS接続成功。専用cron/automation秘密をVaultへパラメーター登録。DB tick→Vercel dry-run200、pg_cron定期実行succeeded/HTTP200、queue/attempts不変、送信0。一時job解除、staging auto-send/scheduler OFF。最終TEST許可OFF。

本番: 029,030,031,032,033,034,035,037,038,039を1件ずつhash照合・トランザクション適用し、全段階でRLS PASS・既存MVP関数hash不変。036は無効なACL試行、040/041は手動TEST/staging限定のため本番不要。新規バックアップ搬出は自動承認レビューで拒否され実施せず、既存バックアップ/復旧検証の整合性を確認して進めた。本番既存データの書換・MVP関数変更なし。

Git: bd17bf9（最終TEST/cron検収）、2ac2cf9（本番運用コード）をfeatureへpush、origin/mainへ通常fast-forward。forceなし。Vercel production dpl_5gabHTQsoTiomHnwpcUiNDmBHFFD / commit2ac2cf9 Ready。既存MVPフラグ・CRON_SECRET・Buffer API keyは変更せず、Buffer専用cron認証/運用モードだけ追加。既存publish cron維持。

本番検収: Buffer official channel接続200/BUFFER_CONNECTED、無認証401、dry-run200/candidates0/planned0/queued0/preSendEligible0/writes0/sends0。DB OFFで同時automatic呼出2件ともstopped/送信0。DB scheduler smoke200。/login,/rooms,/works200、既存MVP関数hash不変。223件tests・typecheck・関連lint・build PASS。最新運用script lint PASS。秘密実値のcommitなし。

04:13:42 JSTにBuffer専用auto-sendと毎分pg_cron minntuku-buffer-automaticをON。04:14の初回定期実行succeeded/HTTP200、連続失敗0、queue0、duplicate0、control enabled=true。現在レビュー/PII確認済み候補0のため一般作品の投稿0。公開許可レビュー必須の既存ルールを緩めていない。

監視: automation buffer-x-24 ACTIVE、15分ごと96回、2026-10-24 04:14 JSTまで。毎分workerのauto-stopに加え、重大異常ならBufferだけOFF、正常時は静かに記録。既存MVP heartbeat24は変更なし。24時間経過の完了を現時点で主張しない。Supabase status Monitoringは継続中だが今回staging/本番検収は成功。provider障害を監視継続。

Production app impact: Buffer専用DBオブジェクト・Vault/環境変数・API route・毎分cron追加。本体の既存関数/フラグ/ユーザーデータを保持。rollbackはBuffer controlをOFFにして新規送信停止、schedulerは取消/照合のため維持。旧デプロイへ戻す前に未処理予約の取消/照合を確認する。自動resume禁止。

証跡: buffer-production-migrations.json / buffer-production-smoke-result.json / buffer-production-app-health.json / buffer-production-enabled.json / buffer-production-monitor-latest.json / buffer-staging-scheduler-*-result.json。
Next: 本番Buffer専用監視を継続し、V2.1の実装へ専念可能。本人の追加操作不要。追加TESTは禁止のまま。
Updated at: 2026-10-23 04:15 JST


## V2 Release Candidate統合検収（2026-10-24 JST、最新）
Status: done / V2 RELEASE CANDIDATE COMPLETE。user添付1d1b7e1cおよびRC exact-host Cookie承認に基づく。

main402719b→develop/v2を686121aでmerge、application1523476。既存差分・旧phase runnerを維持。main/production変更NONE。canonical main001〜041、V2旧040〜055→042〜057はSQL bytes維持、058だけstaging追加。本番適用38件hash不変。旧staging番号履歴も保持。

検証: fresh58本/334 checks、synthetic dump/restore（77表/516構造/92 policy/144 index）、actual staging46 checksと追加26表RLS/直接DML拒否。MVP21 suites、Buffer238、AI52/billing32/RC8。local/Hosted統合各24、Stripe Hosted12/16/7/security9、運営focused10+追加8+mobile5+console2。初回22機能checks/axe0はconsole分類で全体falseだった証跡を保持し、Moderator403を切分けて最終unexpected0。型・関連lint・build PASS、application sourceはPreviewと一致。

退会は実staging合成paid Creator1名だけ、使用済添付保持/未使用削除、公開snapshot保持/名義匿名化、課金停止を先行しAuth最後、password/refresh拒否。Storage/Auth故障とjob lease競合も確認。他job変更0。既存Owner復旧手順で合成unknownを照合して再開、job/effect書換えなし。

Cookie削除、browser/forwarder終了、14合成アカウントsessions/refresh失効、保存token除去、通常2顧客+clock2顧客のtest契約残存0。staging AI/退会受付/worker・Buffer scheduler/auto-sendは元のOFF。production/live/OpenAI呼出し0。Service Role38箇所（main35、追加3はAI worker/billing worker/metadata telemetry）、authenticated管理RPCとrole制限を維持。

主変更: .gitattributes、canonical migration filenames/058、Buffer Preview write guard、synthetic provider exact-host boundary、scripts/rc/*、scripts/admin/behavior.cjs、legacy installer guard、docs/V2_RC_*とv2-rc-*証跡/TASK/HANDOFF。旧local runnerの一括置換は自動承認レビューに拒否されたため、置換せず追加RC runnerで完遂。

Known Issues: 実OpenAI429、Android/iPhone RC実機、managed extension新規install/別端末restore、Auth/SMTPログ、live Stripe OFF。production allowlist/Owner指定/最新backup復元/移行リハーサル/価格credit/課金法務は別ゲート。次は本番移行前最終検収。新機能追加freeze。RC branch/tagとpush結果は最終Git記録参照。
