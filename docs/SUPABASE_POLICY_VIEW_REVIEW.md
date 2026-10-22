# ポリシー・ビュー定義の読み取り専用確認
2026-10-21 / SQL作成済み・未実行・実行承認待ち

## 実行候補
同じフォルダーの supabase-policy-view-review.sql 全文（BEGINからROLLBACKまで）。
対象は minnade-tsukuru / main（project ref: joedeuyrzimqyjapqpyh）。
既存のSQLタブを書き換えず、新規SQL Editorクエリへ全文を入力する。
この作成依頼は実行承認を含まない。承認を受けるまで貼り付け・実行しない。

## 調査対象と出力
- public.posts / rooms / room_members の全ポリシー。SELECT/ALLだけでなくDML用のWITH CHECKも含め、変更時の巻き込みを確認する。
- public.rooms_with_counts / rooms_with_counts_v2 / profiles_public / report_counts の定義とsecurity_invoker/security_barrier。
- 7対象の存在数・OID・所有者OIDとbypassrls/superuser・RLS設定。
- ポリシーのOID、コマンド（r=SELECT、a=INSERT、w=UPDATE、d=DELETE、*=ALL）、PERMISSIVE、適用ロール。
- 伏せ字済みのUSING / WITH CHECK / ビューSELECT定義。
- pg_dependからの直接依存先OID・列番号。対象7オブジェクトだけ既知の名前も返す。
- anon/authenticatedの実効テーブルSELECTと「いずれかの列のSELECT」権限。後者は全列の安全性を証明しない。
- 結果はenvironment / objects / policies / definitions_redacted / direct_dependencies / effective_selectの6区分。空の区分は結果行なし。

## 定義内の値を表示しない仕組み
pg_get_expr / pg_get_viewdefでDB内部に定義テキストを復元し、出力前に制限したトークン列に変換する。復元テキストをSQLとして実行しない。これは文字列の構造レビューであり、定義本文を一切読まない調査ではない。
- SQL内に列挙したキーワード・既知のテーブル/列・短い別名だけ出力する。
- 文字列定数は8個の既知値（forced_publish/open/closed/final/log/creator/core/supporter）だけ出力し、その他は文字列全体を[REDACTED]にする。
- 数値と未知の識別子も[REDACTED]にする。未知識別子のハッシュ等も出さない。
- バックスラッシュ、ドル記号、二重引用符、コメント区切りを含む定義は、限定的な字句処理では安全に扱わず本文全体をNULLにする。
- 未知のポリシー名、ロール名、依存オブジェクト名を出さずOIDで対応付ける。ポリシー名は既存監査結果のOIDと照合する。
- 定義全体や設定値全体を返す「伏せ字解除」列はない。

review_stateの意味：
- absent：式なし。WITH CHECK省略時のUSING継承等があるため、許可なしを意味しない。
- withheld_unsupported_lexical_form：本文全体を保留。
- masked_requires_review：一部を伏せた構造のみ確認可能。
- allowlisted_tokens_only：許可したトークンだけからなる。認可が安全という判定ではない。

これは汎用SQLパーサーではない。別名・数値・条件値の伏せ字で比較対象や集計の意味が確定できないことがある。伏せ字のある定義をそのままDDLへ転用しない。全文が保留された場合も、未加工出力に切り替えず、必要箇所について値を返さない判定SQL等を別途提示する。

## 読み取り専用である理由
- BEGIN ... READ ONLYで開始し、最後はROLLBACK。REPEATABLE READでメタデータを同一スナップショットとして読む。
- SET LOCALはこのトランザクション内だけのタイムアウト/search_path/文字列解釈設定であり、永続的なDB設定を変更しない。
- FROM/JOIN対象はpg_catalogのメタデータのみ。対象テーブルの実レコードやビューの結果はSELECTしない。
- pg_get_expr / pg_get_viewdefは定義復元用。対象ビュー内の関数、ポリシー式、アプリRPCを実行しない。
- CREATE/ALTER/DROP/GRANT/REVOKE、データ変更、COPY、動的SQL、関数作成は含まない。
- 参照でも短時間のロックや負荷は生じる。statement_timeout=15s、lock_timeout=2sで制限する。
- READ ONLY自体は秘密情報の出力防止策ではない。出力制限を別途組み込んでいる。

## 実行時の手順（承認後）
1. 対象プロジェクトを確認し、新規クエリで全文を1回実行する。途中だけ選択してRunしない。
2. environmentでtransaction_read_only=onと対象数を確認する。対象数が7でなければ欠落・オブジェクト種別を調べ、安全性の判定を止める。
3. 成功時は6区分のメタデータだけを保存・評価する。WITH CHECKとSELECT許可は区別して読む。
4. エラー時は未加工定義を出すクエリで再試行しない。トランザクションが残る実行環境ならROLLBACKだけで終了し、SQLの修正版を提示する。エラーに定義断片が出た場合はそのまま転載しない。

## 限界と次の判断
- 実DB上では未実行。構文・権限・結果件数・性能は未検証。
- 既存ビューの直接依存だけを取得する。推移的依存、対象外ビュー、関数本文内の動的SQL等の完全な依存グラフは取得しない。
- 関数の中身やStorage、全列のGRANT、PUBLICのACL内訳、索引はこのSQLの対象外。
- USING true以外の各条件とビューの構造を、出力できた範囲で確認する。伏せ字や未確認依存があれば「調査完了」としない。
- 実ユーザーデータを使うアクセス再現・認可テストは含まない。

## 参照
- PostgreSQL pg_policy: https://www.postgresql.org/docs/current/catalog-pg-policy.html
- PostgreSQL ビューと権限: https://www.postgresql.org/docs/17/rules-privileges.html


## 実行済み更新（2026-10-21）

ユーザーの離席中作業指示で全文無変更実行を承認され、同日1回実行成功。READ ONLY=on、対象7件。SQLファイルは変更していない。本文の実行承認待ちは作成時点の記録。現在の結果はAI_HANDOFF.md第23～25節とSECURITY_AUDIT_2026-10-21.mdを参照。
