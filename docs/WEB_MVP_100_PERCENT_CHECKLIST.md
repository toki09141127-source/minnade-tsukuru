# 最新状態（2026-10-22）
STAGING GO / PRODUCTION NO-GO（反映・運用確認待ち）。
第47節のFINAL_P1_ACCEPTANCE.mdを優先。退会8ゲート・Web・運営UIがPASS、既知Technical P1=0（今回MVP検証範囲）。921検査成功。旧節の未実装/blocked記載は履歴。
本番未反映・運営/法務・実メール/端末確認を終えるまで一般公開GOにしない。

---

# Web MVP 100％チェックリスト

## 第42節の最新公開判定
NO-GO。PRODUCTION_GO_NO_GO.mdの16ゲート: PASS5 / FAIL2 / BLOCKED7 / USER APPROVAL REQUIRED2。
740検査成功（674 offline/合成+31実Postgres+35未認証responsive）。018でMember45/原子的参加を追加、Core guard競合確認。
staging/実Auth/Storage/退会保持・旧Core同意原子性/運営/実機は未完。詳細WEB_MVP_ACCEPTANCE_REPORT.md。以下は過去時点の記録。


## 最新再評価（第41節・今回の結果）
2026-10-21。以下が現在の判定、以降の節は過去記録。648オフライン+19実PostgreSQL検査成功。最新詳細はWEB_MVP_FINAL_PASS_REPORT.md。18領域の公開ゲートで評価し、ローカル検査成功率を完成率と混同しない。
- Security: IN PROGRESS。ローカルRLS/GRANT候補あり。本番無条件SELECT/旧RPC境界は未反映・staging未検収。
- Auth: IN PROGRESS。本人検証あり、実Auth失効/メール/削除の検収待ち。
- Rooms: IN PROGRESS。015の作成原子性と006期限競合をローカル検証済み。実schema/Triggerとstaging検収待ち。
- Membership: IN PROGRESS。旧経路410/Core4/kick制約あり、参加と同意の原子性・既存RPC照合が残る。
- Posts: IN PROGRESS。台帳一体投稿実装済み、同時再送/二重使用の実ローカル競合検証済み。実Storage/Supabase検収待ち。
- Attachments: IN PROGRESS。所有権/EXIF実装済み、013のunused cleanup候補/workerを検証済み、実Storage保持と成否不明upload清掃が残る。
- Works: IN PROGRESS。公開固定/審査実装済み、既存作品と実Trigger検収待ち。
- Likes: IN PROGRESS。本人/可視性検査あり、014のintent/CASと実競合検証済み、flag/staging検収待ち。
- Account deletion: BLOCKED。名義/停止/退避/leaseは実装、イベント所有権/FK・Auth・Storageの一連検収不足。有効化しない。
- Moderation: IN PROGRESS。運営キュー/監査/再送実装、実ローカル競合と017対象認可を検証済み。実Trigger/当番/窓口が残る。
- Privacy: IN PROGRESS。公開列限定/画像metadata除去済み、既存PIIと正式保持判断が残る。
- Legal: USER APPROVAL REQUIRED。運営・専門家確認待ち。AI学習は明確な本人同意なしに利用しない方針を維持。
- Mobile responsive: IN PROGRESS。狭幅修正あり、実主要フロー確認待ち。
- Accessibility: IN PROGRESS。ラベル/focus修正あり、keyboard/reader検収待ち。
- Error handling: IN PROGRESS。主要例外非露出、残経路再走査。
- Analytics: DONE（イベント設計のみ、収集無効）。
- Performance: IN PROGRESS。20接続100rate操作を検証済み。アプリ全体負荷・実費用・未読上限が残る。
- Deployment readiness: BLOCKED。隔離環境・保持・運営の検収前。本番反映だけを残した状態ではない。
安全に識別できる隔離stagingへの合成検証は今回の指示で許可済み。対象不明の環境や本番では実施しない。ローカルPostgreSQLでの代替を優先する。


2026-10-21。対象は一般ユーザー約100人のWeb公開。各領域は、実装だけでなく記載の公開条件を満たしたときだけDONEとする。Status語彙：DONE / IN PROGRESS / BLOCKED / USER APPROVAL REQUIRED / NOT STARTED。
**現在は100％未達、募集開始不可。** 18領域中、計測「設計」の1領域のみDONE。1/18は領域合格数であり開発工数の進捗率ではない。根拠のない87%/95%等を付けない。

1. Security — IN PROGRESS。旧入口停止、添付所有権/RPC、cron、連打/Privacyをローカル修正。合格条件：実RLS/GRANT/既存RPC/StorageのP1解消・staging侵入境界検証。USER APPROVAL REQUIRED。
2. Auth — IN PROGRESS。未入力loginの表示/ラベル確認。合格条件：確認メール/ログイン/再設定/session失効/Auth rate limitのstaging検収。
3. Rooms — IN PROGRESS。create連打制限、一覧エラー/ラベル/折返し。合格条件：creator追加との原子性、検索/AIフィルタ/期限の実フロー。
4. Membership — IN PROGRESS。旧API停止・現行モック成功。合格条件：実RPC・人数競合・同意原子性・退出競合。
5. Posts — IN PROGRESS。原子的投稿案、再送、文字数、本人境界。合格条件：実Trigger/REST迂回封鎖/同時操作。
6. Attachments — IN PROGRESS。台帳/Storage API/形式上限、旧read維持。合格条件：staging Storage・cleanup・内容/EXIF・既存作品・保持方針。
7. Works — IN PROGRESS。ローカル一覧とエラー説明確認。合格条件：既存作品/詳細/署名/期限公開のstaging確認。
8. Likes — IN PROGRESS。可視性・本人・失敗応答・連打を修正。合格条件：重複/並行toggleとDB制約検証。
9. Account deletion — USER APPROVAL REQUIRED。列/FK不一致、名義・共同作品・個人情報・Storage保持を決めて実装/検収するまで不可。
10. Moderation — USER APPROVAL REQUIRED。通報上限/運用案あり。合格条件：担当/窓口/非表示/BAN/異議/復旧の稼働確認。
11. Privacy — IN PROGRESS。メール由来fallbackと公開profile projectionを修正。合格条件：既存データの扱い・RLS・保持/削除・provider条件の承認。
12. Legal — USER APPROVAL REQUIRED。TERMS_READINESS/PRIVACY_READINESS/既存権利リスク整理。合格条件：専門家/運営レビューと実装に合った公開文面。
13. Mobile responsive — IN PROGRESS。狭幅grid/header・modal高さ・file案内を改善。合格条件：主要画面を320〜768px/実機で確認。
14. Accessibility — IN PROGRESS。modal focus/Tab/Escape/復帰、入力ラベル、alertを実装。合格条件：実ブラウザmodal/keyboard/reader検証。
15. Error handling — IN PROGRESS。変更APIの汎用応答・一覧再試行・入力保持。合格条件：全主要フローの障害/部分成功/再送を検収。
16. Analytics — DONE（最小計測設計のみ）。WEB_MVP_ANALYTICS.mdに11イベント、重複・Privacy・funnel・自前/外部比較。実SDK/収集は未導入、導入時は別承認。
17. Performance — IN PROGRESS（試験設計のみ）。100人合成負荷/費用/停止基準案を作成。実測未実施、未読集約/行数上限が残る。
18. Deployment readiness — USER APPROVAL REQUIRED。ローカルtests/type/lint/build、移行/rollback案。合格条件：実監査・staging・バックアップ復旧・運営体制・段階公開承認。

## 証拠

WEB_MVP_IMPLEMENTATION.md：実装/互換性/残P1/DB案/移行/rollback。
WEB_MVP_VALIDATION.md：281検査の範囲、ブラウザ確認、未検証、実機/性能計画。
AI_HANDOFF.md第30節以降：時系列・変更ファイル・Git・承認待ち。
本番反映だけをすれば完成という状態ではない。未確認DB定義、退会方針、実機/負荷検証が必要。
## 退会・通報方針の具体化（2026-10-21）

MVP_RETENTION_MODERATION_RECOMMENDATION.mdを推奨案として追加。Account deletion/Moderation/Legalの公開状態は引き続きUSER APPROVAL REQUIRED。提案作成を方針採用・実装完了と数えない。ローカル検査は追加21件を含む302件へ。

## 退会整合性の追加調査（2026-10-21）

ACCOUNT_DELETION_INTEGRITY.md参照。危険な退会APIをローカルで一時停止し、画面/APIとも未受付を明示。323合成・モック検査、型/対象lint成功。退会機能の完成・公開可能を意味しない。保持方針、正式受付、Trigger/Storage監査、永続的な再試行設計が残る。

## 最新追加実装（第33節）
今回413検査、型/build成功、対象lintエラー0。詳細WEB_MVP_COMPLETION_PASS.md。
DONE（ローカル実装・合成検証限定）：Core4人/kick再参加防止、draft版競合/公開固定、審査と添付差替え失効、moderation監査/復旧、画像EXIF除去、退会job lease/CAS。
BLOCKED：退会実adapter/保持/認可停止、実schema/ビュー/Storage/旧RPC照合、既存公開PII、staging複数接続/実機/100人負荷。AI Creator前提未達。
USER APPROVAL REQUIRED：隔離staging/実環境監査、運営責任者・窓口・正式な保持方針、検収後の本番反映。
上記ローカルDONEを18領域の公開合格と数えない。全体100%未達・募集開始不可を維持。
 
## 退会接続の最新結果（第34節）
全体in_progress。SDK/job/lease/Auth結果照合をローカル接続、439検査・型・対象lint成功。明示承認を得た追加読み取り専用監査を実施し、新たなevents/novel_drafts FK阻害とdecisions/pre-archive notes等のCASCADEを確認。
実保持・匿名化・書込停止・Storage adapterは未接続、Auth削除worker未起動。ACCOUNT_DELETION_ADAPTER.md参照。追加監査案supabase-account-deletion-followup.sqlは未実行。退会機能完成・公開可能とは判定しない。
 
## 制作履歴保持の最新結果（第35節）
承認済み追加監査を実施、5表33列/FK3件を確認。events所有者NOT NULLと関連CASCADEを照合し、本人の制作履歴を復旧用に原子的保存するローカルRPC/SDK準備処理を追加。匿名選択/再送変更検知/lease/一般role拒否を検証。
全456検査、型/対象lint成功。ACCOUNT_DELETION_RETENTION.md参照。退避だけではAuth削除を許可しない。公開保持/匿名化・全書込停止・所有権/FK移行・Storage・stagingが残り、全体in_progress・募集開始不可を維持。今回の追加監査SQLは承認済み実行完了。
 
## 名義・書込停止の最新結果（第36節）
退会受付と匿名名義更新/保持名義保存・書込停止を一体化するローカルmigration009、公開作品の退会名義表示を追加。484検査、型/lint/build/diff成功。ACCOUNT_DELETION_ATTRIBUTION_FENCE.md参照。
本番未適用・フラグ未有効化。書込停止は管理操作も止め得るため、限定管理経路/所有権/FK/Storage/複数接続検収が残る。全体in_progress・募集開始不可を維持。
 
## 限定運営経路（第37節）
退会中の書込停止を維持しつつ、認証済み運営RPCから投稿/ルームのis_hiddenだけを変更するローカルmigration010を追加。権限/退会状態/一回許可/監査原子性を検証。全507件・対象lint・diff成功。
SCOPED_MODERATION.md参照。実Trigger副作用と通報自動非表示/受付の相互作用、複数接続のstaging検収は残る。本番未反映。全体in_progress。
 
## 通報受付保持（第38節）
旧自動非表示の通常SQL失敗でも専用受付をpendingで保持するローカルRPC/API/UIを追加。全530件、型/lint/build/diff成功。承認済み読み取り監査で実reports列・Trigger属性を照合。
REPORT_INTAKE_RELIABILITY.md参照。新フラグ未有効化、pending運営一覧/滞留監視/処理結果管理とstagingが残る。全体in_progress・本番未変更。
 
## 処理待ち通報の運営管理（第39節）
運営専用cursor一覧・24h滞留確認・理由必須の監査付き対応済み管理をローカル実装。退会中運営拒否と対象の書込停止を維持、非表示と監査は原子的。全559件・型/lint/build成功。
REPORT_QUEUE_OPERATIONS.md参照。新flag未有効化。staging/実運営E2E・担当/保持運用は残り全体in_progress。本番未変更。

## 第40節: 運営通報管理の再検証
2026-10-21: UI認証切替競合/二重操作を修正。全575検査・型/lint/build成功。実複数接続・staging E2E未検証。REPORT_QUEUE_HARDENING.md参照。公開判定は未完を維持。
