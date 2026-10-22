# Feature flags（第51節）

最新staging Preview dpl_DsDczF9LzAakarptA5Yv7jUsVRHEは第50節と同じsafe設定。退会REQUESTS/FINALIZE=false、その他12=true、STAGING_TEST=true、DB pause=true、cronなし。本番envは未変更。flagは全体maintenanceではなく直接Supabase/旧deploymentまで停止しない。[最終検収](RELEASE_FINAL_ACCEPTANCE.md)。

<details>
<summary>第50節以前の記録（現在の判定は上記を優先）</summary>

# Feature flags（第50節の配信状態）

ローカル/本番既定のsafe OFF契約は第49節から維持。独立Vercel staging PreviewのみSTAGING_TEST=true、DB_GUARDS/UPLOADS/ROOM_CREATION/ATOMIC_JOIN/ATOMIC_CORE/MEMBERSHIP_GUARDS/LIKE_REQUESTS/REPORT_INTAKE/REPORT_QUEUE/MODERATION/DRAFTS/ACCOUNT_ATTRIBUTION=true、ACCOUNT_REQUESTS/ACCOUNT_FINALIZE=false。DB永続pause=true、cron設定なし。

028は新flagなし。現在同意のapp/DB同時契約が必要。本番projectのenvは名前の存在を読むだけで変更していない。staging Previewの値を本番設定済みと誤認しない。[最終検収](RELEASE_FINAL_ACCEPTANCE.md)。

<details>
<summary>第49節以前の記録（最新判断は上記を優先）</summary>

# Feature flag safety（第49節、2026-10-22）

runtimeの14変数を全件検索。文字列trueだけ有効。値は公開候補で本番設定を変更していない。OFF時の旧書込fallbackは削除。入力/認証の拒否は503より先に400/401/403/404になり得るが、無効機能の副作用はない。

| Flag（MVP_接頭辞） | ON | OFF/未設定 | 安全停止 | 本番初期→検収後 |
|---|---|---|---|---|
| DB_GUARDS_ENABLED | rate/台帳/原子投稿 | rate利用書込・upload・投稿503 | yes、レート制限解除へ戻らない | true→true |
| UPLOADS_ENABLED | 台帳付きupload | upload503、既存添付読取は継続 | yes、独立したupload停止 | false→true |
| ROOM_CREATION_ENABLED | mvp_create_room | 作成503 | yes、旧INSERT/upsertなし | false→true |
| ATOMIC_JOIN_ENABLED | mvp_join_member | 参加503 | yes、旧check/upsertなし | false→true |
| ATOMIC_CORE_ENABLED | Core申請/決定RPC | 503 | yes、旧APIは常時410 | false→true |
| MEMBERSHIP_GUARDS_ENABLED | manage-member/highlight RPC | 更新503、一覧enabled=false | yes、旧mark UPDATEなし | false→true |
| LIKE_REQUESTS_ENABLED | 冪等intent RPC | 503 | yes、旧toggleなし | false→true |
| REPORT_INTAKE_ENABLED | 原子受領/保留 | 受付503 | yes、旧reports INSERTなし。メール案内併用 | false→true |
| REPORT_QUEUE_ENABLED | 運営queue一覧/対応 | 503 | yes、受付/単独非表示は別 | false→true |
| MODERATION_ENABLED | 限定hide/restore | 単独操作503 | yes、queueは別flag | false→true |
| DRAFTS_ENABLED | draft/review/原子publish/公開署名 | 更新・cron・署名503、draft読取disabled、作品利用不可 | yes、旧公開fallbackなし | false→true |
| ACCOUNT_ATTRIBUTION_ENABLED | 検証済み退会名義補完 | 公開作品画面を停止 | yes、名義補完を外して公開しない | false→true |
| ACCOUNT_REQUESTS_ENABLED | DB pause確認付き申請 | 受付503、GET disabled | yes、新規のみ | false→最後にtrue |
| ACCOUNT_FINALIZE_ENABLED | 本人job/secret worker実行 | 申請済みは202保留、cron503 | 入口のみ。実行中停止はDB pause | false→最後にtrue |

DBのdeletion_control.pausedはtrueで停止、falseで実行可能。名前/向きがenvとは逆。最終2flagは揃えて検収し、FINALIZEだけOFFで新規保留を増やさない。切替操作は[退会runbook](DELETION_STOP_RECOVERY.md)。

通常cleanupは公開HTTP/scheduler未接続で独立env flagなし。lib/uploadCleanupだけで自動起動しない。AI推論・学習・Creatorの実装/flagなし。ai_levelは設定値で機能停止switchではない。

OFFで既発行署名URL/実行済みtransactionが消えることはない。env変更には新deploymentが必要で、旧deployment/直接Supabase接続まで瞬時に止まるとはしない。production全入口保守/復元の確認はrolloutの別ゲート。

証拠: deletion-pause-route-checks（209）、deletion-pause-security-route-check（68）、各RPCのlocal/staging検証。ONも原子RPC到達/失敗時に直接書込しないことを検査。実機・production未実行。

</details>

</details>
