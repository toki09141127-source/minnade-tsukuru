# V2.5 管理権限

- 未ログイン・一般ユーザー・退会中・停止中・失効した運営者: 管理情報/管理変更を拒否。
- Moderator: 概要、通報・対象詳細、公開名義/利用状態、ルーム/作品、AIメタデータ、限定Billing状態を閲覧。通報review/resolve/dismiss、対象hide/restore、非運営ユーザーの一時利用停止/解除。自身を含む運営者の利用停止不可。
- Owner: Moderatorの権限に加え、Moderator付与/解除、global feature停止/復旧、ルーム参加/投稿/アップロード停止。Owner追加・自己解除・別Owner変更は不可。
- 監査: Ownerは全件、Moderatorはhide/suspend/reportの操作範囲のみ。いずれも変更/削除不可。
- Billing: 両roleとも必要な状態の閲覧のみ。customer ID・課金PII・返金・サブスクリプション変更・手動credit付与不可。
- サービスキー: 管理操作RPCのexecute権限なし。roleを偽装するAPI引数なし。限定telemetryのみservice実行可。
- Creator/Core: 運営権限にならない。自分のルームの既存AI表示操作は従来の創作者権限のまま。旧moderation_operatorsだけではAI/モデレーションの管理迂回不可。
- DB owner: bootstrap/移行担当の外部運用権限。アプリから利用しない。staging検収で作成した合成Ownerのみ初期登録。
