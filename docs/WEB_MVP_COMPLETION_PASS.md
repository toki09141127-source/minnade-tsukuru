# Web MVP ローカル追加実装・検証（2026-10-21）

## 判定
100%未達。一般100人の募集開始不可。本番反映だけを残した状態ではない。
最新添付指示によりローカルmigration/API/UI/role/退会基盤を実装した。既存差分を保持し、実DB・Auth・Storage・ユーザーデータにはアクセスしていない。実環境の改善を意味しない。

## 実装
- 退会：永続申請・同意版・名義選択・lease/CAS状態遷移。外部削除前にauth_unknownを保存し、再送時に存在確認するオーケストレーター。APIは既定で503未受付。フラグ有効時のみ202申請受付で、完了やログアウトとは表示しない。
- Member：内部supporterは維持し表示メンバー。CreatorのみCore降格・kick。除外者の再参加/申請をDB triggerで拒否、過去投稿は保持。Core上限4、creator整合性、roomロック。highlightはCreator/Coreのみ・期限/公開後拒否・期待値競合検知RPC。
- room削除：Creatorの公開前soft deleteへ。posts/membersを物理削除しない。
- 旧update/mark-read入口を410化。既読UIを既存の認証APIへ統合。approve/reject-coreでcanonical creatorと可視open roomを確認。複数APIのDB例外露出を抑止。
- 添付：既存001台帳/RPCを維持し期限確認を追加。画像はsharp再エンコードでEXIF等を除去。公開承認を本文・添付path・形式のUTF-8長を含むハッシュへ結び付け、差し替え時に失効。
- 読取境界：005は既存permissive policyに追加するrestrictive policy候補。非公開postsは参加者のみ。rooms列のallowlist、直接更新権限と既存SECURITY DEFINERの一般実行を閉じる候補。service_role実行は維持。
- 完成作品：テキスト4種の共同draft、version競合、Creator/Core、期限後保存拒否、cronによる公開固定。空draftは「未確定」。UIテンプレート選択、公開ログ手動確認/除外、PII候補拒否。新draft作品の未承認ログはDB SELECTと公開署名の双方で拒否。
- Moderation：operator表・監査記録・冪等request IDと非表示/復旧を一つのRPCに。運営画面と5種通報分類。運営権限を一般ユーザーへ付与していない。
- Privacy/AI：PII候補検出と安全な入力抽出、未確定fallback、任意生成providerインターフェース。AI Creatorは未実装。外部AI呼出しなし。
- KPI：16イベントの型契約と無効sink。収集SDK/外部送信なし。
- UX：表示role、募集一覧の初期filter、期限表示、既読統合、退会状態・通報入力・操作確認を修正。新UIはfeature flag既定無効。

## 残るP1 / 公開阻害
1. 実環境の無条件SELECT/GRANT/旧RPC/ビュー/Storageと候補SQLの照合・適用検収が未完。ローカル合成DBは実環境の証明ではない。
2. 退会は未完成。DB準備・匿名化・FK対応・利用停止・Storage処理・Auth adapter/workerが未接続。名義選択の受付は基盤であり、実保持処理ではない。運用完成前に受付flagを有効にしない。
3. 既存公開作品は互換性維持のため006の新ログ承認を要求しない。既存PII・旧添付所有権の監査/救済が残る。
4. 実Trigger/旧RPC、複数接続での競合、Storage cleanup、Auth失敗・復旧を含むstaging E2Eが未完。post削除等の複数呼出しの競合が全て解消されたとは言えない。

## 残るP2/P3
- 完成draftの画像block/reorder等UI、AI Creator、provider接続は未実装。
- 画像内文字/OCR、PDF・動画・テキスト添付のPII/metadata/マルウェア検査は未対応。正規表現は氏名/学校/職場を網羅しない。
- 通報queue/BAN等の運用UI、実担当・代理・窓口・異議申立て・保持期間の確定が必要。
- cronの実行頻度（現行日次）によって期限公開が遅延。実hosting条件での頻度設定・監視が必要。
- mobile実機、keyboard/reader、主要ログイン済みフロー、100人負荷・費用は未検証。
- 公開roomsの列制限/room_members policyは既存ビューやmember_countを壊す可能性がある。stagingで照合する。
- DB migration以外にも法務・運営、Authメール/rate設定と退会adapterの実装が残る。

## 検証
ネットワーク遮断runnerの合成/モック検査、tsc、対象lint、ダミー設定webpack buildを実行。
最新結果はcompletion-tests.txt、completion-types.txt、completion-final-lint.txt、completion-final-extra-lint.txt、completion-build-webpack.txt。
旧Turbopack buildは通信遮断下のIPCで失敗したためbuild scriptをwebpackへ変更。失敗ログcompletion-build.txtも保持。
ブラウザ：一時localhostでmoderationフォーム、profile未ログイン、rooms/worksの通信失敗と再試行、login未入力エラーを確認。一時サーバー/タブは停止。新draftのログイン済みE2Eや端末幅変更は未検証。
合成DBは単一接続fixture。実Supabase Auth/Storage/トリガー、RLS owner経路、実ビュー互換性・競合負荷は代替しない。

## 変更とService Role
今回の主な新規コード：lib/accountDeletion.ts、publicationSafety.ts、imagePrivacy.ts、analyticsEvents.ts、
app/api/rooms/manage-member、works/draft、posts/publication、moderation、
app/rooms/[id]/MemberManagement.tsx、WorkDraftEditor.tsx、LogPublicationControls.tsx、
app/moderation/page.tsx、supabase/migrations/202610210002〜006。
既存変更はcompletion-touched-existing.txt、全Git差分はcompletion-git-status.txt参照（以前の変更を含む）。
Service Roleの新規用途：申請job/RPC、管理操作RPC、非公開draftの認可後読取、公開審査の認可後読取/更新。
全APIはBearerをgetUserで検証しactorをserver確定。管理者・creator/core確認はDB RPCでも実施。actorをclient入力から採用しない。
service_roleはRLSを迂回するため、その保持だけで安全とはしない。既存全経路の実RPC検証は残る。

## 次の実装
退会用の匿名公開author/FK・書込停止・Storage保持adapterを、実schema/triggerの読み取り監査結果と照合して実装する。その後、隔離stagingでmigration/RLS/既存作品/競合/期限/退会回復を検収。PRODUCTION_ROLLOUT_PLAN.md参照。

最終実績：413検査成功（65+171+35+3+53+11+75）。型/build成功、対象lintエラー0・警告5。
