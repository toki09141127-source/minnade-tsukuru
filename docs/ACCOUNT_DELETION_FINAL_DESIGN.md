# 退会の最終設計候補・実装境界
2026-10-21。方針採用待ち。受付/実Auth workerは無効を維持。最終設計の提示と実装完了を区別する。

## 推奨する保持方針
公開作品・共同room log・他人の投稿・作品構造は保持する。退会を理由にroom/eventを物理削除しない。過去作者の記録と現在の管理権限を分離する。
公開表示は原則「退会済みユーザー」、本人が明示選択した既存keep_nameのみ名前保持。現実装の表示文字列は「退会したメンバー」で意味は同じ。名義保持はemail/bio/SNS/プロフィールリンク保持の許可ではない。
profileのbio/SNS/avatar参照は公開から除去する。usernameは非公開用の重複しない識別子と表示ラベルを分ける。Auth/emailの関連は最終Auth削除で解消するが、監査用actor UUIDは個人関連情報として制限保持。本文にある個人情報は別審査。
既存009は名義だけを更新しbio/SNSまで除去しない。この不足を匿名化完了と呼ばない。

## Creator・eventの単純な扱い
100人MVPでは自動Core移譲や架空system Auth userは導入しない。未公開共同room/eventの所有者退会はneeds_reviewへ止め、運営が制作継続・公開/非公開保全を確認する。単独未公開roomでも他人の履歴がないことを確認せず削除しない。
退会前room削除を必須にすると共同データCASCADEと衝突するため推奨しない。過去作者IDをAuth非依存にする保持schemaと、現在管理者の受諾付き移譲は後続設計。即時退会を約束せず窓口対応が必要。これは未解決の実装ゲートであり承認だけで完成しない。

## 実DB監査との整合
events.created_by NOT NULL/NO ACTION、novel_drafts.updated_by NO ACTION、rooms.created_by/members.approved_by/requests.decided_by NO ACTIONを個別に処理する必要あり。
decisions/event_members/pre_archive_notes/memberプロフィールのAuth CASCADEは共同履歴を損ない得る。008snapshotは復旧証跡であり公開原本の代替ではない。
提案: 過去作者参照を独立author識別子へ保持し、管理権限を別管理。その移行時だけ元actor参照をnullable等へ変更する案を各FK/Triggerごと審査する。一括CASCADE/Trigger無効化禁止。
監査されたTriggerの属性はあるが本文/全副作用は不足。列定義だけから安全な全FK migrationを捏造しない。保持schema/専用行単位許可のmigrationはこの照合後。

## Storage分類
- 公開作品使用済み: 原則保持、所有者退会でも削除不可。
- 共同制作log添付: 原則保持、非公開でも共同資料。
- 未公開個人upload: 使用済みなら保留・本人と権利確認。unusedとは別。
- unused/orphan: never-used、既知owner、upload完了、期限経過を確認したもののみ清掃候補。
- legacy/成否不明/owner不明: review。prefix全削除禁止。Auth削除時のStorage ownershipサービス制約をtest userで実測する。
planAccountDeletionは上記の分類とCreator/FK/Trigger/write fenceの不足を検知する純粋関数。ready_for_verificationはprepared証明ではない。Storage/APIを実行しない。

## 再試行と工程順序
1. 本人確認・保持説明・同意版→job/名義/write fence同一transaction（009）。
2. snapshot/公開保持/profile情報除去/各FK/Storage保持・owner条件を準備。各工程をjob+policy version+対象集合hashに結び、not_started→processing(lease)→completed、失敗retryable/needs_reviewと記録する設計。再試行で対象集合が変われば再審査。
3. preparation verifyで同一job/actor、現在lease、全証跡を照合。現adapterのboolean receiptを誰でも作れる成功stubで代替しない。
4. prepared→auth_unknownを先に永続化。Auth削除は最後の外部不可逆工程。成功応答だけでなく正しいuser_not_foundを照合しauth_deletedへ。403/500/timeoutを不存在扱いしない。
5. Auth非依存のjobで最終整合検査・完了記録。Auth後に残ってよい処理は記録/確認だけ。削除済みuser認証を復旧の前提にしない。
6. 外部成功・DB記録失敗は同じjobで前進回復。Auth再作成/他user付替え/旧profile書戻しはしない。
現003/007/adapterはjob単位のstage/lease/CAS実装済み。工程別永続証跡、FK/Storage準備、運営再審査再開、受付完了通知は未実装。安全停止を解除するために必要。

## 有効化条件
実Auth/Storage/実Triggerで上記全工程・同時更新・停止中の直接REST・全session・故障再送を検収し、公開profile/共同作品を確認。窓口・保持方針を採用した後にのみworkerと受付flagを接続。
現状BLOCKED。今回の事前判定20件は実退会E2Eを代替しない。
