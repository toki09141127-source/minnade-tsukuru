# 追加メタデータ整理・依存監査

2026-10-21。既存のsupabase-metadata-audit-2026-10-21.csv等をローカル再解析した。新たな本番接続/SQL/ユーザーデータ取得は行っていない。

## 直接DB権限（カタログ上のGRANT）

anon/authenticatedは両方とも、posts・rooms・profilesについてSELECT/INSERT/UPDATE/DELETE=true。room_members・room_join_requestsはSELECT=true、INSERT/UPDATE/DELETE=false。5tableはいずれもRLS=true、FORCE RLS=false。
これはGRANT段階の実効権限であり、全行に実際のDMLが成功するという意味ではない。RLSのUSING/WITH CHECKを通る必要がある。posts/rooms/room_membersのpolicy本文は既存詳細監査を参照し、profilesとroom_join_requestsは本文を未確認のため行単位認可の安全性を断定しない。

works/work_likesというrelationは保存した対象メタデータに記録がなく、この採取範囲だけでDB全体に存在しないと断定しない。現コードの作品一覧はrooms_with_counts_v2のforced_publish、いいねはroom_likesを使用している。存在しない前提のmigrationを追加せず、追加監査時に名称と依存関係を確認する。

room_members.last_seen_atは更新policyがあってもauthenticatedのGRANTがfalse。今回ブラウザcomponentを既存本人確認付きseen APIに統一。GRANT変更は未実施。
profiles_publicとpublic_profilesは別名のrelation。公開profileページと投稿RPCが使用するpublic_profilesの定義・権限も別途検証する。ビューがsecurity_invokerでも下のtableが無条件SELECTなら保護にならない。

## 依存監査と更新

初回`npm audit --omit=dev`はCritical1 / High5 / Moderate1（7 packages）。Next16.1.6を16.4.2、eslint-config-nextを同versionへローカル更新。npm audit fixは互換範囲のみ、install scripts無効、--forceなしで実行した。
公式アドバイザリの[AVIF画像最適化問題](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)は影響条件付きのCritical。すべてのアプリに同じ攻撃が成立するとまでは判断していないが、公開前の更新を優先した。[16.4.2リリース](https://github.com/vercel/next.js/releases/tag/v16.4.2)も確認した。
更新後の本番依存監査は0件。これは既知advisoryに対するその時点の結果で、未発見の脆弱性やアプリの認可問題の不存在を保証しない。
全依存では開発用braces→micromatch→fast-glob→Next ESLint系の同一根本問題が5 packages/Highとして残る。入力が深くネストしたglobの場合のDoS。自動提案はeslint-config-next14へのmajor downgradeのため採用しない。信頼できない外部globをlint設定へ渡さない。upstream修正版が出たら再監査し更新する（P2、開発/CI対象）。

証跡：mvp-dependency-audit.json（前）、mvp-dependency-audit-after.json（全依存後）、mvp-dependency-production-after.json（本番依存後）、mvp-dependency-update.txt、mvp-dependency-fix.txt。ファイルには公開パッケージ情報のみ。registry照会時にアプリユーザーデータ/秘密を送信していない。
