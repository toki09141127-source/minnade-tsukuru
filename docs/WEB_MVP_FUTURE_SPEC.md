# 将来仕様の受け皿（2026-10-21）
今回の公開前安全修正と分離し、大規模rewriteは行わない。

## 決定済み方向
- UIの役割: Creator / Core / Member / AI Creator。DB supporterはMemberの内部表現として維持可能。
- MemberからCore申請、最大3回、同時pending1件、Core最大4人。Core辞退とCreatorによるMember降格、kickを区別する。
- voluntarily leftは再参加条件付き、kickedは再参加不可。Creator権限移譲は受諾を伴う別操作として設計する。
- 作成後の設定変更不可、ジャンル、最大2週間、定員を明示する。
- 制作ログsearch/filter、highlight、public exclusion、AIまとめ、completion draft、block-based works、「この作品ができるまで」を整理する。
- UI方向は「クリエイティブオフィス」、コピーは「つくりたい人、集合。」。
- 本人の明確な同意なくユーザー作品を生成AIの学習目的に利用しない。推論API送信の同意/範囲/保持は別管理。AI未接続を維持する。

## 現行との差
- Core4、Creator管理によるdemote/kick、kick再参加拒否はmigration002でローカル実装済み。
- Core申請3回・同時pending一意・Memberからの昇格のみという条件は現行API/既存RPC全体で未保証。
- 現行Core退出には5分制限があり、任意時点のCore辞退とは一致しない。
- 現行期限上限は150時間。2週間=336時間への拡張はUI/API/DB/規約を揃える別変更とする。
- 現行Member45枠はAPIでcount後insert、人数競合は残る。実DB triggerのCore4だけではMember45を保証しない。
- 作成時の設定は原子的作成候補015に固定入力するが、既存RPC/GRANT経由の変更可否は公開前検収が必要。
- draft/公開固定/ログ審査は006、AIまとめとAI Creatorは未実装。公開除外のlegacy作品への遡及は保持/権利/PII判断が必要。

## 次の互換migration案
申請履歴を削除せずroom/user単位でロックし、pendingがあれば同一申請IDを返し、新規申請は履歴回数<3を強制する。
既存pending重複は自動削除しない。適用前カタログと合成fixtureで確認し、既存データの解消手順は別承認。
部屋行を共通ロック順序とし、同意version検証・サーバー時刻・人数制約・入会/承認を単一RPCにまとめる。
Core辞退は降格理由と時刻を履歴に保存し、kickとは別stateにする。これは今回未適用・未実装の案。


## 第42節互換性確認
018はsupporter表現を維持しMember45制約と同意原子化を追加、Core3回/任意辞退/AI Creator/2週間等は実装しない。
member identity変更禁止は移籍を新membershipとして扱う方針。Core→Member降格時も45枠が満杯なら拒否するため、将来辞退UIではこの扱いの判断が必要。
highlight/検索/公開除外/AIまとめ/block作品/制作過程/Creative Office UIのschemaを制限しない。account作者と現在管理者分離は将来移譲の前提だが、今回複雑な自動移譲は追加なし。
