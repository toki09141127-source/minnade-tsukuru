# V2 RC backup / restore plan

Scope: 計画のみ。本番backup取得・DB/Auth/Storage変更は今回行わない。RCのfresh検証は合成データを使う。

## 前提
本番main 402719b、MVP001〜028、Buffer029〜035/037〜039が適用記録にある。036・040・041は本番適用済みとは扱わない。V2旧番号を本番へ適用しない。対応表と本番manifestをhash照合する。
本番移行日には最新main・DB metadata・停止状態を改めて確認する。2026-10-22のbackupを現在時点の復旧点とみなさない。

## 本番移行直前に別承認で取得するもの
- DB: schema、data、sequences、RLS/ACL、functions/triggers、Auth依存・新旧公開snapshot、添付台帳、通報/監査、退会job/effects、AI task/credit ledger、billing event/operation、Buffer queue/review/control。
- Storage: DB台帳と実体の対応表、保持するobject本体とhash。署名URLをbackupとしない。
- 設定: Auth/SMTP/redirect、公開feature flags、cron schedule・停止状態、Vercel source/envの参照先、Stripe環境・商品price対応。秘密値は別の承認済み暗号化保管に置く。Vaultの復号キーをlogical dumpで復元できるとは扱わない。
- 整合性: 全書込入口とworkerを停止・drainし、Storage/Auth/Stripe/Bufferの成否不明な副作用を解消してから同じ復旧点を採る。停止中も既発行URLや閲覧者のコピーは取り消せない。

## 隔離復元
本番へrestoreしない。新しい隔離DB・test Storageへ復元し、外部HTTP、AI、billing、Buffer送信とcronを停止。メールも送信しない。
row count、FK/check/index、RLS/ACL、署名関数、sequence、公開/非表示/退会保持、添付hash、billing/credit/監査の冪等性を照合する。
本番dataの持出しと閲覧は別承認・アクセス管理が必要。今回のRC検証で代替しない。

## Rollback
1. 新規操作を停止し、処理中の外部副作用をdrain/reconcileする。
2. DBは前進修正を優先。旧い広いGRANTや無条件SELECTへ戻さない。適用済みSQLの削除・番号変更・downをしない。
3. appを戻す場合もV2表/台帳を残し、互換性が検証済みのsourceと停止設定だけを使用。
4. AI creditの手動付け戻し、Stripe webhookの盲目的再送、Buffer unknownの再送は禁止。
5. Auth/Storage削除、公開済みX投稿、外部決済はDB復元だけではundoできない。外部の現在状態と照合し、削除/非表示を再適用する。
6. 復元後はTEST対象だけで検収し、通常書込→AI→課金→退会の順を個別判断。Bufferの意図的停止を勝手に解除しない。

復旧担当: 運営者が指名。判断者・実施者・時刻・復旧点・外部整合確認を事故記録に残す。DPAPIの別端末復号、PITR、実データの目標RPO/RTOは未実証で本番前の確認事項。

## 今回の合成restore実績
RC native fresh DBの合成データだけをpg_dump custom形式で保存し、同一隔離cluster内の別DBへpg_restore。77表件数・516構造・92 policies・144 indexes・正規化ACL一致。GRANT配列の並び順差を権限差と誤認しないようaclexplodeで比較した。dumpとclusterを削除、停止確認。実運用のStorage/Authサービス復元・本番データ復旧を証明するものではない。証跡: v2-rc-fresh-result.json。
