# 退会処理のDB整合性・途中失敗調査（2026-10-21）

## 状態と今回の範囲

ローカルの危険な退会処理を一時停止。退会機能を完成させたものではなく、100人公開の阻害要因は残る。本番変更・追加本番監査・実アカウント操作なし。
前回取得済みメタデータ（AI_HANDOFF第18–19節）と現在のコードを照合した。現在の本番状態を再取得したとは主張しない。
保持・名義方針はMVP_RETENTION_MODERATION_RECOMMENDATION.mdの未採用案のまま。

## 確認した問題と優先度

- P1：旧処理はprofiles更新とAuth Admin削除を別リクエストで行い、後者失敗時に前者が確定済みになる。現実の監査スキーマでは先に列不一致で失敗するため、この部分成功は「列だけ修正した場合や別スキーマで到達する危険」であり、本番被害の確認ではない。
- P1：rooms.created_by / room_members.approved_by / room_join_requests.decided_byのAuth参照は監査時NO ACTION。参照が残る利用者のAuth削除は失敗し得る。所有者だけでなく承認履歴も対象。事前SELECTだけでは確認後に新しい参照ができる競合を解決しない。
- P1：FKエラー回避のために所有ルームを削除する修正は不可。roomsからposts / room_membersへのCASCADEで他人の投稿・参加も消え得る。全FKを一律CASCADEへ変える修正も不可。
- P2：profiles.user_id / display_name / avatar_urlは監査時に不存在。旧APIは最初の更新で失敗し得る。実行検証ではなくメタデータとの照合。usernameへの単純置換は名義方針を勝手に採用するうえ、後続失敗経路を有効にする。
- P2：更新結果の件数を確認せずerrorだけを見るため、対象0行でも後続へ進む設計だった。旧モックも不存在列をUPDATEで拒否せず、Authエラーテスト成功は実DBで削除可能という証明になっていなかった。今回、実PostgreSQLエンジンの合成fixtureで不存在列・0行成功を検証。
- P2：Auth削除時はprofiles.id / public_profiles.id / room_members.user_idのCASCADEがあり、公開名義・参加履歴の保持と衝突する。投稿等に保存されたusernameは別物。set-usernameルートはprofiles、公開用public_profiles、posts、room_membersを別々に更新するため、プロフィール1行を消すだけで名義を消去したとはいえない。
- P2：成功直後の応答喪失、タイムアウト、同時退会、退会中の投稿/プロフィール更新に対する永続的な状態・再実行識別子がない。Auth削除後に同じBearerで本人確認できることを再試行の前提にできない。
- P2：Storage所有オブジェクト、実Trigger/RPC、Auth削除後の既存トークン利用、public profile再生成経路は未検証。Auth SDKのdeleteUserは既定でshouldSoftDelete=falseのHTTP DELETE。soft deleteへの切替だけで整合性を解決した扱いにはしない。
- P3：旧画面は不可逆な削除の確認を求め、汎用エラーで再試行を促していたが、未受付・部分成功・完了不明を区別できなかった。

## 実施した局所修正

- account/delete：既存Bearer本人確認を維持し、認証成功後は503 / ACCOUNT_DELETION_UNAVAILABLE / ok:falseを返す。401/503ともno-store。退会申請を受け付けていないことを明示。
- Service Role依存、profiles更新、Auth deleteUserをこのルートから除去。環境変数で旧処理を再有効化する抜け道は設けない。
- DeleteAccountButton：削除要求・確認ダイアログ・ログアウト・成功表示を除去し、準備中かつ未受付を表示。古い画面・直接HTTPはAPI側でも停止。
- アカウント停止・データ消去・名義変更・受付記録の作成は一切実装していない。連絡窓口を捏造していない。
- 互換性：既存API成功応答を待つクライアントには503となる。監査済みスキーマで元々正常完了できない処理を、安全な明示停止に置換したもの。別環境で旧APIが成功していた場合も利用不可となる。リリース前に正式な受付経路の整備が必須。

## 再開可能な退会処理の設計案（未実装）

以下はDB変更・保持仕様・運用決定が必要なため提案のみ。Auth/Storageの外部呼出しを通常のDBトランザクションと一体にROLLBACKできる前提にしない。

1. 再認証した本人から名義選択・保持説明への確認を取得。申請IDを払い出し、同一アカウントの進行中申請を一意にする。サーバーでactorを確定し、bodyのuserIdは信用しない。
2. 申請の保存と利用停止状態を同一DBトランザクションで確定。各書込みRPC/直接RLS/Service Role APIが同じ停止状態を確認し、申請との競合をロック等で直列化する。プロフィール更新やTermsConsentGateの再作成も対象。サインアウトだけを認可停止とみなさない。
3. 共同作品・公開名義・承認履歴の移行を、合意済み方針に沿ってDB内で原子的に準備。Authと独立する公開author識別子やNULL化の選択は要決定。creatorの引継ぎ・公開保留、承認履歴の意味を維持する設計が必要。
4. Storageの所有者依存・削除条件を追加監査後、必要な清掃/保持処理を永続ジョブ化。全オブジェクトを一括消去してAuth削除を通す処理にはしない。消去対象の確定と実消去を分離し、保存先の参照を先に失わない。
5. Auth削除はサーバーワーカーが実行し、申請IDで結果を記録。ジョブと証跡は削除対象auth.usersへのCASCADEで消えない設計にする。権限は専用サーバーに限定。
6. 外部呼出しタイムアウト時はoutcome_unknownとして照合へ進む。存在しないと確認できた場合だけAuth段階を完了にし、ネットワークエラー/403/5xxを「既に削除済み」と扱わない。新しいメールアドレス一致などで別アカウントを対象にしない。
7. DB・公開表示・Auth・必要なStorage処理の完了条件を照合し、全条件達成後だけcompleted。利用者に完了を通知する経路と、退会後に安全に状態を確認する仕組みが必要。メール送信や窓口設置は今回行っていない。

## 失敗段階ごとの扱い（提案）

- 受付トランザクション失敗：未受付と返す。プロフィールやAuthを変更しない。
- 受付後のDB準備失敗：利用停止/申請状態を保持し、原因を限定記録して再試行可能にする。勝手に受付を取り消さない。
- FK違反：needs_review。参照元/制約名を運営の限定ログに残す設計。利用者には内部SQL/個人情報を返さない。FK削除・ルーム削除で自動修復しない。
- Storage失敗：永続ジョブを保留し、保存/消去の確定方針に従って再試行。Authの状態だけで全体完了にしない。
- Auth失敗確定：準備済み名義を無条件に書き戻さない。途中に加えられた更新を上書きする補償UPDATEは危険。工程記録から再開。
- Auth成功・応答喪失：outcome_unknownを照合し、既存申請で復旧。クライアントのログアウト成否に全体完了を依存させない。
- Auth成功・完了記録失敗：ワーカーがAuth状態を照合して記録を再開。申請レコードをAuth削除から独立させる理由。
- 二重要求/ワーカー重複：申請一意制約、工程比較更新、期限付きlease等で排他。重複通知や同じStorage対象の再削除は冪等に扱う。
- 取消：不可逆操作前の取消可能範囲を方針決定する。Auth削除/Storage消去後の「rollbackで元通り」は約束しない。デプロイを戻して旧削除APIを復活させる運用もしない。

## 追加調査・承認の境界

USER APPROVAL REQUIRED：
- 共同作品/名義/creator引継ぎ/承認履歴の保持、取消、保存期間、利用停止中の閲覧範囲、受付・完了通知と運営窓口。
- profiles/public_profiles/posts/room_members/rooms/room_join_requests/auth.users関連の全FK・Trigger本文・公開名義同期関数、およびStorage所有者制約の追加読み取り監査。次回SQLはユーザーデータを対象にせず、内容を提示して実行承認を得る。今回は実行していない。
- 申請/ジョブ/author identityとFK・RLS・認可の変更設計。合成DB検証後、隔離stagingでAuth/Storage/複数接続の故障注入・再試行検証。実環境反映は別承認。

次の推奨順：追加メタデータ監査のSQL案→保持・名義と受付方法の決定→退会状態/ジョブ設計レビュー→合成/隔離staging実装検証→承認後の公開判定。
現状で自己退会不可のまま100人公開可能とは判定しない。

## 検証と限界

- security-audit-check：旧退会3検査を13検査に置換。未認証/無効Bearer/認証済み/DB失敗想定/Auth失敗想定/creator/再送、無変更、no-store、未受付表示を確認。既存他ルート検査も維持。
- account-deletion-db-check：11合成PostgreSQL検査。不在列3、0行成功、先行更新残存、Auth残存、別名義残存、approved_by/decided_by制約、ルームCASCADE、Auth CASCADE。
- Fixtureは監査で確認した制約の最小モデル。整数ID・一部列のみで実スキーマの完全再現ではない。新しい本番の事実を発見したものではなく、既知制約と処理順序の失敗メカニズムを検証したもの。
- 実Auth HTTP、実Trigger、実Storage、複数接続、認証済みブラウザE2Eは未検証。



## 第46節: 最終仕上げの結果（2026-10-21、最新）
総合NO-GO。詳細はFINAL_FINISHING_ACCEPTANCE.md（指定18項目）。旧節の「client ACLで全Webが止まる」は解消。
021/022をstaging fwqucffxdmbdczspkcyrへ適用。本人profiles/membershipだけの読取、公開profile列限定、新mvp_room_list、本人同意RPC、公開draftの匿名読取を整備。旧view/DMLは開けていない。
実Webは作成/参加/同意/投稿/添付/既読/Core却下→再申請→承認/期限公開/作品/like/report/profile/logout/匿名添付bytesまで完走。認証後18＋通報3の幅検査PASS。タイマーhydrationを修正。
今回906チェック成功（offline697/local監査schema73/native31/staging63/Web42、再開重複除外）。弱点/失敗条件再現を含むため完成率とはしない。型・対象lint・通信遮断build・diff成功。
退会Auth削除は監査schemaでwrite fenceとCASCADEの衝突を再現。FK保持主体/専用cleanup/元UUID公開遮断/既存job補正が未実装。UI/API準備中とAuth保持を維持、最終worker未接続。ACCOUNT_DELETION_FINAL_GATES.md参照。
P1未解決3群以上（退会整合性、本番未反映の権限/旧経路、既存公開PII/保持検収）。本番反映承認を求められる状態ではない。
次: 匿名保持主体＋限定prepare→退会Storage→Auth/再送の実検証→残E2E/復旧/運営。技術作業の追加承認不要。人手は実メール・運営窓口/当番・法務/実機。
branch security/fix-storage-sign。既存全差分/削除2件保持。今回021/022/UI/検査/台帳/docs変更。本番アクセス/変更、commit/push/deploy/merge/reset/clean/stashなし。sources不変。
