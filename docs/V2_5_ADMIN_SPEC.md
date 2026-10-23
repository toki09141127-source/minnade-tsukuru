# V2.5 運営管理画面仕様

Status: COMPLETE（staging / Hosted Preview）。証跡と限界はV2_5_ACCEPTANCE.md。本番適用は別の移行検収が必要。

## 境界
- develop/v2、Supabase fwqucffxdmbdczspkcyr、minnade-tsukuru-staging Preview専用。
- productionへの管理機能の有効化・DB変更・公開配信、Stripe live、実OpenAI再送は禁止。
- Creator/Coreと運営Owner/Moderatorは独立。メールアドレスによる権限付与をしない。
- admin_usersはDB ownerのみbootstrap可能。アプリはOwner追加/削除を提供しない。Ownerは自己解除や別Ownerの権限変更不可。

## DB / API
053: admin台帳、停止・通報状態・利用停止、immutable audit、内部メモ、レート制限。
054: 既存投稿・参加・添付/Storage・作成・公開・退会/AIの停止ガード。既存の厳密な退会/モデレーションcapabilityを再利用。旧service運営RPCへの権限を撤回。
055: 必要な列だけを返す上限26件の管理投影。UIは25件と次頁有無を表示。

/api/adminは検証済みBearerとDB roleを両方確認。変更は同一Origin、JSON、8KB以下、明示確認、理由・500文字以内のメモ必須。DBが操作ごとにactive role/退会/利用停止を再照合。変更は1時間以内に発行されたJWTを要求する。これはtoken freshnessであり、password再入力やMFAを証明しない。更新番号によるCASとrequest UUIDで変更・監査・メモを同一transactionに格納。失敗時に成功監査を残さず、秘匿された失敗分類を別記録。失敗試行も30変更/分、読み取り120/分の上限へ計上。

DB停止と書込は共有/排他lockで順序を定める。先に許可されたDB transactionは完了し、その後にOFFが確定する。OFF確定後の新規書込は拒否。外部送信済みStorage/Stripe/Auth/AI要求を取消済みとみなさない。退会は既存pause/外部副作用checkpointを維持し、started/unknownの未完了副作用があれば再開を拒否する。

## 画面
Overview / Reports / Users / Rooms / Works / AI / Billing / System / Audit。System内に権限管理。取得失敗は0件表示に置換しない。読み込み・空状態・競合・権限切れを明示。検索/状態/期間/並び順/ページング。対象詳細のリンクは管理APIで権限を再確認。

通報はopen → reviewing → resolved/dismissed。本文のhide/restoreは別操作。privacyを優先度1。旧対応済み通報は再処理不可。利用停止は公開作品を残し、新規制作・投稿・アップロード・参加・手動AIを止める。ユーザーの本文変更・永久BAN・物理削除は提供しない。

## プライバシー
通常一覧は公開名義・UUID・状態だけ。通報理由/本文/作品snapshotは運営が対象詳細を開いた場合に限定。Auth email、決済customer/subscription ID、認証URL、AI prompt/outputのrawpayloadは返さない。AIはtaskメタデータのみ。Billingは状態/期間/集約creditのみで、返金・手動credit・プラン変更を提供しない。

監査はallowlistのbefore/after、操作者/role、理由、target、request、時刻。内部メモも追記のみ。秘密・PIIパターンを含むメモは拒否するが、自由記述の完全な個人情報検出を保証しない。画面とrunbookで最小記録を要求する。失敗/cron事象はactor/category/分で重複排除。件数はリクエスト総数ではない。観測なしを成功扱いしない。

## 運用境界
DBスイッチは起動時環境変数の許可も必要。意図したAI OFF・退会ワーカーOFFは保持。Bufferはstaging未接続として表示し、production Bufferは対象外。実OpenAI429はKnown Issue、今回再送しない。
