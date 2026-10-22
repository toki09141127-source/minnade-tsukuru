# 退会の最新完了条件（第41節）
過去のINTEGRITY/ADAPTER文書は当時の記録。以下が今回の再評価。

## 実装・検証できている部分
- 本人確認、確認文面/versionと名義選択、永続job、段階CAS、lease、Auth応答喪失時の存在照合。
- 退会受付と匿名名義/保持名義、書込停止の原子化（009）。
- 共同制作履歴の復旧用スナップショット（008）。公開表示の保持そのものとは区別する。
- 退会中対象への限定moderation、退会中担当者の拒否（010〜012）。
- 今回、実ローカルPostgreSQLで運営退会/対象匿名退会と同時通報処理のロック・結果整合を検証した。
- 未使用添付の清掃worker候補（013）。退会中actorを自動清掃対象に含めない。これはAuth削除準備証明の代替ではない。

## Auth削除を止める必須条件
1. events.created_by NOT NULL/NO ACTION、novel_drafts.updated_by NO ACTIONと、decisions/event_members/pre_archive_notesのCASCADEが監査済み。所有ルームやイベントを消して解決してはならない。
2. 公開author identity（過去の作者）と運営管理者（現在の権限）を分け、受諾済み後継者へ管理権限のみ移す案が推奨。後継者なしは運営保留。架空Authへの移管はしない。正式採用が必要。
3. Auth CASCADE自体が009の書込停止Triggerに拒否される可能性がある。全tableのguardを解除したりservice roleなら無条件通過に変更しない。行/列/工程を限定した削除専用許可と実Trigger照合が必要。
4. Storage上のowner条件、使用済み添付の保持、旧台帳なし添付はSupabaseサービスとして未検証。SQL FKがないことをAuth削除可能の証明にしない。
5. プロフィールのbio/SNSと既存公開本文PIIの取扱いは名義変更だけでは解消しない。公開保持・例外非表示・保管期間・窓口を運営が確定する。
6. verify/prepareが全条件を証明できない場合needs_reviewを維持。API/cronに実削除workerを配線しない。

現在はローカルのみで安全にAuth削除完了まで接続できる証拠が足りない。「退会準備中」を外すための成功stubは作らない。
本番に何も適用しなくてもコードは型/build可能だが、機能が完成したことを意味しない。
本番変更なし、Auth削除なし。全体公開阻害（BLOCKED）を維持する。
