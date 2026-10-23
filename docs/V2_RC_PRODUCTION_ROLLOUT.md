# V2 RC production rollout proposal

**Production Changes NONE。以下は未実行の提案。V2→main、production migration/deploy、live billingを許可する文書ではない。**

## 正規の順序
1. RC DoD、latest mainとの差分、canonical map、全適用hash、最新staging証跡をレビュー。branch/tagをsourceに固定する。
2. 本番移行の対象・停止時間・担当・復旧判断・ユーザー告知を明示承認する。
3. 全入口をmaintenanceにし、直接Supabase/Auth/Storageと旧deploymentの書込も考慮。publish/AI/deletion/Buffer cronを停止し、in-flight/unknownを処理する。元の停止状態を記録する。
4. 最新backupを取得し、隔離restoreを成功させる。Storage/Auth/Stripe/Bufferを含めて復旧点を照合する。
5. 本番適用済み001〜035/037〜039は再実行しない。036はpg_net ACL試行の歴史的失敗であり適用候補に入れない。040 manual testは本番で必要か個別判断。041のstaging認証経路も本番宛てに余分な資格情報を送らないことを確認。番号だけで一括db pushをしない。
6. V2 canonical042〜057、追加058を依存順で適用。各transaction後にschema/ACL/RLS、旧MVP互換・データ保全を確認。失敗/成否不明なら停止し、同じ番号を盲目的に再実行しない。
7. 本番用に別レビューした互換appを配信し、TESTのみで検収。一般書込、共同制作、公開、運営、AI、billing、退会を個別ゲートで戻す。
8. 24時間監視の範囲・欠測・通知先を明示し、段階的に利用者を増やす。Bufferは元の運営意図に従う。

## 現在のRCと本番の差
- V2/管理は正確なstaging URLでのみ有効。現RCをそのまま本番に置くだけではV2は有効にならない。本番許可条件のコードレビューと境界テストが別途必要。
- billingはStripe test専用・productionで拒否。live key/価格/恒久Webhook/課金・税・返金・商取引表示・監視は未承認。Free共同制作の公開とlive billing公開を分けて判断できる。
- 合成AIは明示opt-inのstaging Preview限定。productionで合成AIへfallbackしない。実OpenAI429は未再送、品質・費用・利用枠の検収待ち。
- Admin Ownerの初期指定は合成担当を流用しない。運営者本人を確認し、bootstrapを監査する。Moderatorは限定権限を維持。
- 退会のpauseと新規受付は別。billing stop、公開名義・制作履歴保持、外部effectの完了が揃うまでAuth削除を進めない。

## 適用方法・監査
旧stagingは旧V2番号040〜055で適用されたまま維持。canonical042〜057を適用済みと偽装しない。058のみ別incremental manifestに記録する。
migration選択はfile名+hash+依存のreview済みリストで行う。SQLをカテゴリ別に並べ替えない。transactionとDDL/ACLの組を維持する。
再構築には監査済みbaselineの非公開artifactが必要。アクセス権とhashを確認した担当だけが利用する。raw定義を公開docsへ転載しない。

## 監視と停止判断
HTTP/Auth、5xx/429、AI失敗/lease/credit、billing pending/quarantined/署名拒否、通報滞留、退会effect、RLS変化、Buffer unknown/cancel/receiptを件数だけで記録する。
Supabase管理Auth/SMTPログは別確認。未収集を正常とみなさない。RLS漏えい・自己昇格・二重課金・他room AI・退会整合性・本番取り違えは即停止。
