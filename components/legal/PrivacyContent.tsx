import React from 'react'
import { CURRENT_PRIVACY_VERSION } from '@/lib/legalVersions'

const LAST_UPDATED = CURRENT_PRIVACY_VERSION

function getContactEmail() {
  const fromEnv =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    process.env.CONTACT_EMAIL ||
    ''
  return fromEnv.trim()
}

type Section = {
  id: string
  title: string
  body: React.ReactNode
}

export default function PrivacyContent() {
  const contactEmail = getContactEmail()

  const sections: Section[] = [
    {
      id: 'basic',
      title: '1. 基本方針',
      body: (
        <p>
          みんなで作ろう（仮）（以下「本サービス」といいます。）の運営者は、
          ユーザーの個人情報および利用者情報の重要性を認識し、
          個人情報の保護に関する法律その他の関係法令を遵守し、適切に取り扱います。
        </p>
      ),
    },
    {
      id: 'info',
      title: '2. 取得する情報',
      body: (
        <ul>
          <li>アカウント登録情報（メールアドレス、認証用情報等）</li>
          <li>プロフィール情報（ユーザー名、自己紹介、SNSリンク、アイコン画像等）</li>
          <li>投稿情報（文章、画像、添付ファイル、コメント、制作ログ、作品情報等）</li>
          <li>ルーム情報（参加履歴、役割、同意記録、AI利用レベル関連情報等）</li>
          <li>お問い合わせ情報</li>
          <li>通報・削除申立て情報</li>
          <li>利用履歴、アクセスログ、IPアドレス、Cookieその他識別子、端末情報、ブラウザ情報</li>
        </ul>
      ),
    },
    {
      id: 'purpose',
      title: '3. 利用目的',
      body: (
        <ul>
          <li>本サービスの提供、維持、改善のため</li>
          <li>本人確認、認証、アカウント管理のため</li>
          <li>共同制作機能、投稿機能、閲覧機能等の提供のため</li>
          <li>利用規約違反、不正利用、権利侵害等への対応のため</li>
          <li>お問い合わせ、削除申立て等への対応のため</li>
          <li>重要なお知らせ、規約改定、機能変更等の通知のため</li>
          <li>セキュリティ確保、障害対応、監査対応のため</li>
          <li>統計データの作成、品質向上、機能改善のため</li>
        </ul>
      ),
    },
    {
      id: 'third-party',
      title: '4. 第三者提供',
      body: (
        <>
          <p>
            運営者は、法令で認められる場合を除き、本人の同意なく個人情報を第三者に提供しません。
          </p>
          <ul>
            <li>法令に基づく場合</li>
            <li>人の生命、身体または財産の保護のために必要がある場合</li>
            <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合</li>
            <li>国の機関または地方公共団体等への協力が必要である場合</li>
            <li>事業承継に伴って個人情報が提供される場合</li>
          </ul>
        </>
      ),
    },
    {
      id: 'outsourcing',
      title: '5. 外部委託・外部サービス',
      body: (
        <>
          <p>
            運営者は、サービス運営に必要な範囲で外部事業者に業務を委託することがあります。
          </p>
          <ul>
            <li>認証基盤</li>
            <li>データベース、ホスティング、CDN等のインフラ提供事業者</li>
            <li>メール送信事業者</li>
            <li>分析・監視・エラートラッキング事業者</li>
            <li>ストレージ、画像配信、ファイル保存事業者</li>
          </ul>
        </>
      ),
    },
    {
      id: 'cookie',
      title: '6. Cookie等の利用',
      body: (
        <>
          <p>
            本サービスでは、利便性向上、ログイン状態の維持、利用状況の把握、不正利用防止等のために、
            Cookie、ローカルストレージその他類似技術を利用することがあります。
          </p>
        </>
      ),
    },
    {
      id: 'security',
      title: '7. 安全管理措置',
      body: (
        <ul>
          <li>アクセス権限の管理</li>
          <li>認証情報の適切な管理</li>
          <li>通信の暗号化</li>
          <li>ログの記録および監視</li>
          <li>外部サービスの権限管理</li>
          <li>脆弱性対応および障害対応</li>
        </ul>
      ),
    },
    {
      id: 'retention',
      title: '8. 保存期間・削除',
      body: (
        <ul>
          <li>退会後も、法令対応、紛争対応、不正防止、監査、バックアップ等のため一定期間保存する場合があります。</li>
          <li>共同制作物に組み込まれた投稿や公開済み成果物は、直ちに完全削除されない場合があります。</li>
          <li>保存の必要がなくなった情報については、合理的な方法で削除または匿名化に努めます。</li>
        </ul>
      ),
    },
    {
      id: 'disclosure',
      title: '9. 開示・訂正・削除・利用停止等',
      body: (
        <>
          <p>
            ユーザーは、法令に基づき、自己の個人情報について、開示、訂正、追加、削除、利用停止等を求めることができます。
          </p>
          <ul>
            <li>請求を行う場合は、本人確認のうえ、運営者所定の方法によりご連絡ください。</li>
          </ul>
        </>
      ),
    },
    {
      id: 'policy-change',
      title: '10. 本ポリシーの変更',
      body: (
        <ul>
          <li>運営者は、必要に応じて本プライバシーポリシーを変更することができます。</li>
          <li>変更後の内容は、本サービス上での掲示その他適切な方法により周知します。</li>
        </ul>
      ),
    },
    {
      id: 'contact',
      title: '11. お問い合わせ窓口',
      body: (
        <>
          <p>本ポリシーに関するお問い合わせは、以下の窓口までお願いします。</p>
          {contactEmail ? (
            <ul>
              <li>
                メール：<a href={`mailto:${contactEmail}`}>{contactEmail}</a>
              </li>
            </ul>
          ) : (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                background: 'rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>問い合わせ先メールが未設定です</div>
              <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                本番運用では環境変数で設定してください：
                <br />
                <code>NEXT_PUBLIC_SUPPORT_EMAIL</code>（推奨） または <code>SUPPORT_EMAIL</code>
              </div>
            </div>
          )}
        </>
      ),
    },
  ]

  const toc = sections.map((s) => ({ id: s.id, title: s.title }))

  return (
    <>
      <div className="muted" style={{ marginTop: 8 }}>
        最終更新日：{LAST_UPDATED}
      </div>

      <div className="readableBox" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>目次</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          {toc.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`}>{t.title}</a>
            </li>
          ))}
        </ul>
      </div>

      <div className="readableBox" style={{ marginTop: 14 }}>
        {sections.map((sec) => (
          <section key={sec.id} id={sec.id} style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 16, margin: '18px 0 8px', lineHeight: 1.35 }}>
              {sec.title}
            </h2>
            <div className="prose">{sec.body}</div>
          </section>
        ))}
      </div>
    </>
  )
}