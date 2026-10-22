# AIクリエイター・KPI実装準備

2026-10-21。設計案のみ。外部AI呼出し、DB変更、cron追加、計測SDK追加はしていない。法務/UGC/AIは正式開発テーマとしてLEGAL_RIGHTS_RISK_REGISTERと追跡する。

## 固定する製品境界と未確定事項

ユーザー指定の境界：1roomに専属AIは最大1、AI禁止roomには作成も稼働も送信もしない。補助可は控えめ、自由は積極的、人間が活発なら黙る。AIはfinalを書かない。投稿の常時表示は「AIクリエイター / みんつく公式AI」。Authユーザーを作らず、人間の参加人数/core枠/権限を消費しない。
「本人の明確な同意なしに作品を生成AIの学習目的に使わない」は重要方針候補。推論送信同意とは別に採用判断する。provider契約・保持・学習設定が確認できるまで実送信は始めない。

## 現DBとの衝突と候補構造

現在posts.user_idはNOT NULL uuid、auth FKなし。AIを作るために架空user UUIDを詰める案は採らない。既存表示名・profiles join・削除・RLS・集計が人間user_idを仮定するためDB/UI/APIを横断する別承認が必要。

- room_ai_creators候補：id UUID、room_id UNIQUE FK、mode、enabled、persona_version、consent_version、created_at、last_ai_at、last_human_post_id、last_human_at、generation_epoch、daily_usage。人格設定は短い固定テンプレート、秘密や個人情報なし。人のプロフィールと区別する。
- posts候補追加：author_type（human/ai）、ai_creator_id nullable。humanはuser_id必須/ai_id NULL、aiはuser_id NULL/ai_id必須/post_type!=finalとするCHECK案。既存human行は段階backfill、旧reader対応後に制約強制。現NOT NULL変更は今回は未実施。
- AI creatorとpost.room_idの同一性は複合FKまたは確定RPCで保証、通常userはauthor_type/ai_creator_idを指定不可。
- ai_jobs候補：room_id、reason、generation_epoch、context_version、dedupe_key UNIQUE、state、lease_until、attempts、not_before、budget_reserved、error_code。状態pending/running/completed/cancelled/failed。運用記録に作品本文やtokenを残さない。
- ai_usage_daily候補：room/day、user相当の利用主体、tokens/cost予約と確定値、成功/拒否/失敗。日次境界はUTC固定で表示だけJST等へ。課金tierと独立した硬い上限。

## room作成→初回挨拶

room作成が成功した後、同一DB transactionのoutboxでroom設定/AI同意に応じAI creatorとgreeting jobを一度だけ登録する案。AI外部呼出しをroom作成HTTP内で待たない。AI禁止ならcreator/outbox行を作らない。既存roomへの遡及作成は別同意。
初回挨拶はroomのユーザー提供本文を無条件送信せず、許可済み最小設定で生成または固定文。先に人が投稿した場合は挨拶を短縮/取消する方針。重複jobはdedupe_keyで1投稿に抑える。

## 停滞支援のスケジューリング案

初期仮値（全て承認・実測で調整）：補助可は人間無活動60分/cooldown120分/1日2回、自由は無活動30分/cooldown60分/1日4回。全modeで連続AI投稿を禁止し、人間投稿が入るまで次の自動支援はしない。greetingも日次上限とコストに算入する。
cronは候補room IDだけをqueueへ、workerがlease claim。人間のlast_human_atを基準にし、AI自身の投稿をinactivity判定の入力にしない。期限公開/hidden/deleted/closed/AI禁止/同意撤回/人間不在ならjob取消。人間の閲覧だけを「投稿が活発」と断定せず、まず人間投稿が直近にある場合は沈黙する。
workerは送信前と保存直前でepochとroom状態・最新人間活動を再確認。生成中に人が活動したら保存しない。処理中に禁止へ変更されたら追加送信/投稿を止め、送信済データの取り消し限界を説明する。

## context・安全性・コスト

context初期案：同意済みでvisible/未削除の人間投稿のみ最新20件、合計6000 input tokens、最大400 output tokens。AI過去出力は重複抑止用の最小summaryだけ。添付/原本・プロフィール・メール・招待コード・未公開別room・通報者情報は送らない。退室者の寄与を送る権限は個別方針が決まるまで除外。blockで見えない内容をAI経由で漏らさない。
contextはデータであり命令として扱わない。tool call/外部fetch/任意SQL不可。出力は長さ・危険内容・再現/人名/リンクをcheckし、不合格なら投稿しない。AIがUI上の人間名を名乗ってもauthor_type表示はサーバー固定。
コスト式：input_tokens×input単価/1M + output_tokens×output単価/1M + 再試行/その他料金。provider/model未選定なので金額を捏造しない。room/user/globalの日次予算をjob前に予約し、確定/返却、外部課金の結果不明なら保守的に消費計上。room乱立対策、登録直後制限、global kill switch。無料枠超過時は静かに停止/必要なUI通知、勝手に有料呼出しへ移らない。

## retry・logging・確定

一時429/5xxのみ上限2回・指数backoff+jitter案。認証/同意/入力/安全性拒否はretryしない。生成後のDB失敗は同じjob/postの一意キーで再保存し、外部生成を無条件再実行しない。worker crashはlease expiryで回復するが一意制約で二重postを拒否。
ログはjobId/room疑似ID/モデル・prompt version/使用token/待ち時間/結果code/概算費用。本文やcompletionは通常logへ出さない。品質調査の本文保存を追加するなら目的・同意・期間を別承認。保持期間候補は技術metadata30日/集計90日、課金/法的証拠は別定義で運営承認待ち。
AI post保存は専用server/RPCでauthor_typeを固定し、final不可をDBでも保証。一般post APIにはAI author偽装を許さない。API名だけで管理者権限にしない。旧posts RLS/GRANTの穴を閉じるまでAI設計を公開しない。

## 将来のみんつく＋

有料tierは発言量増加より、context品質/整理支援/予約機能などを検証。人間が活発なら沈黙、AI禁止、同意、final禁止、global予算は課金しても解除しない。tier切替/解約/返金/課金復元、storeのデジタル課金条件を実装前に検討。広告や作品学習を有料誘導の条件にしない。

## KPIイベント契約（実装案）

共通fields：event_id、schema_version、server occurred_at、source(web/mobile/desktop/server)、疑似user_id/room_id、session_id（必要時のみ）、experiment_id、actor_type。本文・ファイル名・Storage path/署名・token・メール・生IPを分析イベントへ入れない。書き込み結果はserver確定イベントで、client clickと区別。event_id/idempotency_keyで重複排除。分析の保存期間/同意/opt-outをPPと揃える。

- signup：Auth登録完了のserver確定。フォーム開始や失敗を登録人数に数えない。
- room_created：DB確定時、AI mode/ジャンル等は粗い区分だけ。
- room_joined：初回active参加確定、roleとfirst/rejoinを区別。承認requestを参加数にしない。
- first_post：本人の最初の成功human投稿、user単位とroom単位は別metric。
- attachment_uploaded：台帳uploaded確定時、型/size帯だけ。投稿に使用した率はusedイベントと結合。
- ai_posted：DB保存成功時、job_id/reason/mode/context_version/token/cost帯。外部生成成功だけでは数えない。
- human_post_after_ai：ai_postedの後24時間以内に同roomで最初のhuman投稿が確定した時。直近の適格AI postへ帰属、各AIにつきbinary1。作者・閲覧の因果は断定しない。削除/テスト/運営botを除外するルールを定義。
- work_completed：初めて完成状態へ遷移、human final有無とforced_publishを区別。「時間切れでログ公開」を人間の完成数へ混ぜない。
- repeat_visit：有効sessionの別日訪問、D1/D7 cohort、bot/自身の管理確認を除外。
- like：toggle結果liked=trueのみ、取消は別event。連打で人気を水増ししない。
- paid_conversion：決済providerの確定webhook、重複排除、返金/取消を別event。未実装機能の成果を記録しない。

## 主要指標と意思決定

北極星候補：週あたり「複数人のhuman寄与を伴う完成作品数」。先行指標：参加→24h内human first_post率、D7再訪、room完成率。
AI主要指標：24h追跡を終えた適格AI投稿のうちhuman_post_after_aiが発生した割合。分母に直近24h未経過のAIを混ぜない。room単位の人間投稿/次回訪問/完成率とセットで評価。AI発言数自体は成果指標にしない。
ガードレール：通報率/非表示率、AI停止/撤回率、room離脱、1活性化あたり費用、p95待ち時間、無活動AI連投ゼロ。新規room/既存room、mode、人数で層別し、少数集団が特定される表示を避ける。
因果評価：AI許可/同意済roomのみroom単位のholdout候補。禁止roomを実験対象にしない。自然な再開をAI効果と誤認しないため同期間・同条件で比較し、サンプル不足なら結論保留。目標値/実験期間はbaseline取得後に決める。

## 実装開始の前提

USER APPROVAL REQUIRED：AI推論送信/学習方針、provider契約、料金上限、保持期間、参加者の同意/撤回、DB author変更、queue/cron、課金・分析導入。
先行チケット：既知P1解消→権利/同意方針→API/RPC仕様→合成fixtureで禁止/撤回/重複/人間活動競合/final拒否→小規模opt-in試験。今回は機能を実装していない。
