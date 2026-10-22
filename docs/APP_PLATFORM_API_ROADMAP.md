# Web・デスクトップ・モバイル展開とAPI設計

2026-10-21。比較・提案のみ。依存追加、アプリ雛形、認証方式変更、配布は行っていない。再利用率は実移植前に数値化できないため相対評価とする。

## 現状と最小コスト方針

Next.js16.1.6/React19.2.3/Supabase/Vercel。rooms/worksはdynamic SSR、room詳細でserver client/admin照会、ブラウザにSupabase session、更新は主にBearer API、旧core処理はCookie。現在のアプリ全体を単にstatic exportに変更するとSSR/API/Cookie機能を失う。
最初はWebの認可・作品完成体験を整備し、次にPWAを提案。UI/SSR/APIをほぼそのまま使えるため現時点の最小追加コスト。ネイティブ機能が必要になった段階でモバイルCapacitorの限定試作、デスクトップTauriの限定試作を比較する。利用者ニーズが確認される前に3クライアントを保守しない。

## 選択肢（現在のコードに対する評価）

### PWA：最優先候補

再利用：既存Web UI/SSR/APIを最大限維持。Auth：既存Cookie/ブラウザsession、redirect維持。upload/image picker：Web File API、camera：browser権限・capture/getUserMedia、OS差を実機確認。push：Web Push、許可とOS対応が必要。iOSはホーム画面追加等の条件あり。deep linkはHTTPS URL。App Store/Play公開の代わりにURL/ホーム追加で配布。desktopも対応browserのインストール機能。更新はWeb/SW cacheの管理、非公開投稿/API/署名URLはoffline cacheしない。開発/維持は比較的小、OS統合/背景実行は制約あり。[Next公式PWAガイド](https://nextjs.org/docs/app/guides/progressive-web-apps)。

### Tauri：desktop需要が出たら検証

再利用：HTML/Reactのclient UIは高いが、ローカル同梱Nextにはstatic exportが必要でSSR/Route Handlerをそのまま内包できない。サーバーAPIはVercelに残す。公式の[Next連携](https://v2.tauri.app/start/frontend/nextjs/)もstatic exportを指定。
Auth：OS browser+PKCE/deep link、tokenはOS安全保管。files：選択範囲だけnative API、camera/pickerはplatform別plugin/機能検証。通知とpush backendは別設計、local通知をpush受信と混同しない。deep link/custom schemeを登録し検証。Windows/macOS署名・notarization・installer・署名付きupdateを準備、store配布も別審査。権限capabilityを限定しUGCへnative権限を与えない。開発中、Rust/plugin/OS差の維持はWebより大きい。mobile対応も選択肢だが今回の優先案にはしない。

### Electron：強いdesktop統合が必要な場合

再利用：Web UI高、ホストされたWebを表示可能。SSR/APIはクラウド継続を推奨し、Service Roleをアプリ同梱しない。Authは外部browser/PKCE/deep link、storageは安全保管。file/camera/picker/通知はbrowserとnative bridge、remote push受信は別設計。Windows/macOS配布・署名・auto updater運用が必要。iOS/Android用の解ではない。
UGCを表示するためnodeIntegration無効、contextIsolation、sandbox、IPC送信元/引数検証、外部リンク許可list。Chromium/Node/Electronの追随が必要で容量/更新コストは相対的に大きい。[公式security](https://www.electronjs.org/docs/latest/tutorial/security)。この用途では当初優先しない。

### Capacitor：Web UI再利用を優先するmobile候補

再利用：React DOM/CSSのclient部分は高い。ビルド済Web assetsをnativeへ同期する方式で、現在のSSRを丸ごと置換できない。Web shellをAPI駆動化する範囲が必要。[公式workflow](https://capacitorjs.com/docs/basics/workflow)。ホストURLを包むだけで審査/安全性/UXを解決したとしない。
Auth：system browser+PKCE、callback/deep link、WebView Cookieとnative sessionの境界を設計。upload：Blob/URI変換とサイズ制限、camera/image picker：plugin・権限・metadata除去、push：APNs/FCMとtoken登録解除。App Store/Google Play配布・署名・審査、更新は基本store経由、live update採否はstore規則確認。native bridgeをUGCから隔離。開発/維持は中、OS SDK/plugin追随が追加。desktop主用途ではない。

### React Native + Expo：native UXが主目的になった場合

ExpoはReact Native開発/配布を支援する選択肢で、別のUI互換技術ではない。DOM/CSS/Next navigation/RSCは移植が必要。TypeScript型・API client・入力validation・業務ルールは再利用しやすいがUI再利用は低め。supabase-jsとの[公式連携](https://docs.expo.dev/guides/using-supabase/)あり。
Auth：native session+PKCE/deep link、refreshのforeground/background調整、安全保管。camera/image picker/file uploadはnative URI/権限処理、pushはAPNs/FCMまたはExpo経由、device token失効を管理。iOS/Android store配布、EAS等でbuild/update可能だがnative変更には新build、審査要件は残る。desktopは別対応。開発/維持は大きいがnative操作性を重視できる。現在は保留。

## 共通認証・配布条件

- [Supabase native deep link](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)に基づきredirect allowlist、PKCE、callback state/失効、一回限りcode交換を検証。queryへaccess/refresh tokenを自前で渡さない。Webのsame-site cookieをnativeにも当然利用できると仮定しない。
- JSへService Roleを配布しない。sessionのrefresh/logout/アカウント削除後失効、共有端末、lost-deviceも設計。
- camera/photos権限は使用時だけ。取り込み後も同じ台帳/owner/RLSを通す。mobileだからpath所有権を信頼しない。
- store出品は包装方式よりUGC通報/ブロック/連絡先/未成年/削除体験の準備が先。[Apple guidelines](https://developer.apple.com/app-store/review/guidelines/)、[Google UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)。有料プランは地域/提供形態別の課金規則も実装前再確認。今回価格や審査通過は保証しない。
- ネイティブ配布/自動updateは署名・鍵管理・rollback・OS CI・クラッシュ対応を継続コストに含める。金額/工数は画面移植試作前には見積確定しない。

## API現状と改善順

1. app/api/posts/create、uploads、uploads/sign、rooms/create/join系はBearerをgetUserで検証しておりnativeからも呼べる基本形。現状は相対URLのfetch、可変JSON、重複認可が散在。API origin設定・共通DTO・error.code・request_idを追加する将来案。
2. rooms/[id]/core-*はCookie routeでUIパスも不整合。安全な現行Bearer APIに統合する前に既知P1を解消。認証の二重受理を安易に増やさない。Cookie writeにはCSRF/Origin、Bearerには厳密token検証、CORSを認可と混同しない。
3. SSRでしか取れないrooms/works詳細は、権限評価済みread DTO APIを設計しWebも共用候補。RSCをnativeから直接再現しない。secret列をDTOへ入れない。
4. uploadsはmultipart+server pathからupload_idへ。nativeのURI→bytes変換、大容量・再試行・413、署名期限、重複submitを契約化。完成後のfile hash/sizeをサーバーで確定。
5. posts/room join/approveはtransactionとidempotency key、server timestamp、consent version検証をAPI契約に含める。ページングcursor、公開/active/hidden境界、429/Retry-Afterを統一。
6. 最小OpenAPIまたは型付き契約とroute contract testsを先に整備し、/api/v1採用は旧client移行期間込みで判断。HTTP method/statusの互換を勝手に変えない。
7. offline投稿は初期実装しない。導入時は再接続後に最新room/role/同意を再認可。cached JWTを認可根拠にしない。私的cacheはlogoutで消去。

## 段階的ロードマップと判定条件

Phase0：DB認可/旧API/添付/削除/運営窓口を整える。Phase1：Webで「参加→最初の投稿→完成」を計測。Phase2：PWA install/pushの小規模検証（非公開cacheなし）。Phase3：実ニーズをもとにCapacitorでログイン/1画面/画像添付/pushだけの試作、desktopにはTauriで同じ試験。Phase4：Web UI再利用では満たせない操作性が数値で確認されたらExpo検討。
試作の合格条件は起動/ログイン復帰/deep link/投稿再送/権限拒否/非公開情報漏れなし/署名更新/削除/OS差。人日や再利用パーセントは試作で測る。今回は設計だけ。実装・配布・認証設定変更はUSER APPROVAL REQUIRED。
