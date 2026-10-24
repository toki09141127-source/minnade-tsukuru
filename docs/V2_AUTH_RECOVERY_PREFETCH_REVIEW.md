# iPhone再設定リンクの再利用対策（staging適用・iPhone実機PASS）

対象: Supabase staging fwqucffxdmbdczspkcyr。Production Changes NONE。
新Preview: https://minnade-tsukuru-staging-b7zdudurb-sonetokiyas-projects.vercel.app

## 確認できた事実
本人報告はAUTH-01。最新メールのstaging project・i8kvltx12 callback・recovery用途は正しい。READ ONLYの対象テストアカウントmetadataで、06:49:34送信、06:49:53認証コード発行、その後の新sessionなし。staging Authログは06:49:53に指定アカウントの303、06:50:25に無効/期限切れ403を示す。最初のアクセスが先読みだったか、人の操作だったかは未確定。原文・IP・認証リンク・秘密値は保存しない。

## 修正
回復メールの入口を/auth/confirmとし、開いただけではverifyへ進めない。「再設定を続ける」の明示操作で、設定済みSupabaseの/auth/v1/verifyへ一度だけ進む。認証方式は既存PKCEのまま。callbackのinitialize/getSession/getUser必須条件を維持。

TokenHashはURL fragmentで受け、描画時にURLから消し、メモリだけに保持。DOM、リンクhref、localStorage/sessionStorage、ログへ入れない。認証先・recovery用途・同じoriginの/auth/callback?next=reset-passwordをアプリ側で固定し、入力から任意URLを受け取らない。欠損、不正形式、追加/重複パラメータはAUTH-10で拒否。検収前に既存sessionがある場合も、ボタンを押すだけでパスワード変更は行わない。

callbackはerror_codeの既知分類だけをAUTH-xxへ変換する。raw descriptionや不明値は出力しない。既知のotp_expiredは今後AUTH-02で表示するが、過去のAUTH-01をさかのぼって期限切れと断定しない。

## 承認対象
この新Previewだけの短期Cookie取得・利用、iPhone用共有への置換、staging callback2件追加、およびstaging Reset passwordテンプレート変更。テンプレートはRedirectToが新Previewのreset callbackに完全一致するときだけ新画面へ送り、それ以外は既存文面/ConfirmationURLを維持する。Confirm sign up、SMTP、Site URL、本番、認証期限、PKCE、RLSは変更しない。

具体案: v2-staging-recovery-template-proposal.html。現行文面: v2-staging-recovery-template-before.html。実TokenHashを文書へ置換しない。本人が新Preview限定4件を明示承認。staging Reset password本文を保存・再読込で確認済み。Subject、他テンプレート、期限、SMTP、Site URLは維持。

## 検証と限界
offline UI32、安全境界21、型・限定lint・build PASS。実SDK+合成Authのbrowser5ケースPASS。独立した先読みブラウザではverify/token送信0、本人側の明示クリック後verify1/code exchange1、PKCE challenge一致を検証。通常別タブ成功とverifier欠落/不一致/期限切れ拒否を維持。320/390/1440幅、axe違反0。自動検収は実メール送信なし。続く本人操作で物理Safariの全手順PASS（末尾参照）。

実メールの条件分岐・描画は本人の1回の送信後に確認する。新Previewの保護Cookie・共有・2callbackはhost限定の承認後に実施。Hosted4ケース/3幅/axe0/実Auth送信0 PASS、自動検収Cookie削除・browser終了済み。共有だけ実機待ちで維持。成功判定にはiPhoneの新password設定・旧拒否・新login/reloadを本人が確認する。本番はNO-GO。

## 復元・終了
必要ならReset password本文をbefore.htmlへ復元。新templateの条件は1つのPreviewに限定するため他hostのメール経路は変わらない。自動検収Cookie削除・browser終了、検収終了後共有停止。Webhook転送や実OpenAIは開始しない。

参照: [Supabase公式のメール先読み対策](https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching)。明示ボタンを挟む方式を採用し、秘密値をアプリへのHTTP queryへ載せないようfragmentを用いる。


## 2026-10-24 07:21 JST 実機結果
本人が新確認画面・明示ボタン・新password設定・旧拒否・新login/reloadを全完了。メール条件分岐の実描画はこの本人報告で確認し、認証リンクやpasswordを取得していない。新sign-inと後続logoutのsessions0/有効refresh0をREAD ONLYで照合。共有停止、Cookie削除、一時process0。初回アクセス主体は未確定であり、メール先読みが確定原因とはしない。
