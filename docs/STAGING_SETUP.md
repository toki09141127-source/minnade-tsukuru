# Supabase staging setup（第43節）
2026-10-21。productionはDO NOT MODIFY。新staging作成・接続・基礎サービス検収は完了。アプリschema検収はBLOCKED。

## 作成・分離
- staging: minnade-tsukuru-staging / fwqucffxdmbdczspkcyr / Sydney ap-southeast-2 / NANO。
- production: minnade-tsukuru / joedeuyrzimqyjapqpyh / ap-south-1。変更・再監査なし。
- Free組織内でユーザーが新規作成。初回READ ONLY/ROLLBACKでpublic tables/Auth users/Storage objects/bucketsすべて0。
- production DB/ユーザー/Storage/作品/secretのコピーなし。別project URL・キーを確認。
- 同じFree組織の利用枠は完全独立とは限らない。負荷試験を無制限にせず、quotaを監視。料金操作なし。
公式枠: https://supabase.com/docs/guides/platform/billing-on-supabase （無料有効2project、アカウント内のOwner/Admin組織合算）。作成画面/組織表示はFree。paid add-onなし。

## 接続
.env.localは一切書換えない。.env.staging.localはstagingだけのキーで新規作成し、Git除外・現在Windows利用者限定ACL。チャット/docs/ログへ値は保存しない。
現在は既存legacy anon/service_roleキーを利用。新形式画面は省略文字列で完全キーを得られなかったためガードで拒否され、完全なlegacyキーへ訂正してref/role照合・実接続成功。新キー作成/回転はしていない。
.env.staging.exampleはplaceholderのみ。プロジェクト名/ref/分離証拠はdocs/staging-project.json。
専用scriptsはdotenv.parseでこのファイルだけを読み、process.envからproductionキーを継承しない。本番envは比較のために内部で読み、値を出さず同一キーを拒否する。
通常のnpm run dev/buildはstaging起動手段ではない。Nextは.env.staging.localを自動読込しない。アプリE2E用の分離起動はbaseline整備後に準備する。

## Safety guard
STAGING_TEST=true、environment=staging、synthetic marker、確定project ref、fresh/ユーザー確認/Free manifestを必須。
production ref、URL偽装（suffix/port/query/credentials）、productionキー一致、legacyJWTの別ref/別roleを拒否。JWTdecodeは署名検証ではなく設定照合であり、接続試験は別。
DB接続はdb.<staging-ref>.supabase.co:5432だけ・TLS証明書検証必須。pooler/SSL無効化は未対応として拒否。DB passwordは未取得・未保存。
npm run staging:check はoffline設定検証のみ。
npm run staging:smoke はAuth health/REST schemaのGET2件のみ。login/アプリ全体合格ではない。
npm run staging:db-check は直接DB接続情報をローカルで設定した場合だけREAD ONLY/ROLLBACK、カタログと件数のみ。

## Bootstrapとmigration
npm run staging:plan は001〜018のhash/順序を出すだけで適用しない。
重要: 001はrooms/posts/room_members/public_profiles/authを前提とする。新規Supabaseにはアプリ基礎schemaがないため、001〜018を今すぐdb pushしてはいけない。
既存監査にはcolumns534/constraints181/functions47/triggers226等の属性はあるが、DEFAULT/CHECK/enum/既存関数・Trigger定義全文がない。
supabase-staging-baseline-audit.sqlは追加読み取り専用監査案（未実行）。承認後の取得結果はsecretを含む可能性をレビューしてから再構築に使用。raw関数本文はpublic docsへ保存しない。
基礎schemaはschema-only bootstrapとして候補をローカル生成→合成DB検証→空stagingへ適用。実行順はbootstrap→001〜004→005/006→007〜012→013〜018、毎段階smoke。
旧危険ACLを実stagingで再現する場合も認証/合成限定で計画し、公開の危険な中間状態を作らない。基礎schemaを推測/簡略化した検証を本番互換PASSとしない。

## 合成Auth / Storage
npm run staging:integration は書込みあり、新規synthetic runを作る。無意味な再実行をしない。
6 test usersをexample.invalidで作成（Creator/Core等は別名だけで、アプリrole付与は未実施）。パスワードは安全乱数、.staging-private内へ利用者限定ACLで保存。
追加1件のアプリデータなしAuth userだけ削除・再login拒否を確認。実退会フローではない。
専用private bucket1個、合成PNG1個を保持。bucket size4MB/MIMEimage/png、anon download/sign/upload拒否確認。signedURL/tokenをログ保存しない。
17 PASS。メール確認signup、自然期限切れ、運営権限取消、アプリowner/台帳/退会/既存Triggerは未検収。
結果: staging-integration-result.json、staging-integration.txt。ID/bucketは合成証跡、秘密なし。

## Cleanup / reset
検証済み6ユーザー・bucket/objectを保持。run manifestにないものは触らない。自動cleanup/reset/dump再投入なし。
cleanup候補はstaging-integration-result.jsonの対象IDのみ。後続FK/台帳/保持検収が終わるまでAuth/bucketを削除しない。
project再作成はキー/refが変わりガード再設定必須。productionや同じ組織の他projectの削除は禁止。

## Troubleshooting
STAGING_KEYS_REQUIRED: 省略表示・placeholderを使わない。値をチャットへ貼らない。
STAGING_IDENTITY_NOT_VERIFIED: manifestを推測してtrueにせず、作成・空状態の証拠と照合。
STAGING_DB_TARGET_REJECTED: production/別ref/pooler/queryは拒否。直接DB IPv6が使えない場合は接続設計を別途検討しTLSを無効にしない。
missingBaseline: migration実行停止。seedを先に流して存在しない表を無理に作らない。
実サービスのエラーはraw応答/tokenを出さず固定コードだけ記録。課金/無料枠制限なら停止。

## 残るユーザー判断
追加のschema-onlyメタデータ監査を承認するか（SQL案を事前提示）。本番ユーザー行は読まない。
Creator/未公開room・イベント保持/名義の正式方針と運営窓口。DB password/キーはチャット不要。

## 第44節更新（2026-10-21）
基礎schemaと001〜018はstaging適用済み。前節の監査待ち/未適用は過去状態。staging-applied.json/staging-schema-plan.json参照。実schema22検査は scripts/staging/schema-integration.cjs、実監査local12はbaseline-local.cjs。実検証は新しい合成6人とroom/postsを作り保持するため無目的な再実行をしない。
raw metadataはrepo外の利用者限定ACL下でのみ保持。prepare-schemaはprivate inputからSQLを作るだけで実行しない。空baseline条件があるため再作成用途として既存stagingへ実行しない。以後のDB変更は新migration。client ACLは閉じておりWeb互換性未検収。最新STAGING_SETUP_RESULT.md参照。
