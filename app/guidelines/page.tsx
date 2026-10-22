import LegalLinks from '@/components/LegalLinks'
import SupportContact from '@/components/SupportContact'
export default function GuidelinesPage() {
  return <article className="page" style={{maxWidth:800,margin:'0 auto',padding:24,lineHeight:1.9}}>
    <h1>コミュニティガイドライン</h1><p>みんつくの初期MVPは18歳以上の方を対象としています。共同制作のために、次のルールを守ってください。</p>
    <ol>
      <li>自分に権利があるもの、または利用を許可されたものを投稿してください。無断転載をしないでください。</li>
      <li>自分や第三者の住所・電話番号・秘密情報などを公開しないでください。</li>
      <li>嫌がらせ、差別的攻撃、なりすまし、違法なコンテンツを投稿しないでください。</li>
      <li>スパム、制作妨害、追放後の迂回参加、繰り返しの悪用をしないでください。</li>
      <li>他の参加者の寄与を尊重してください。成果物の外部利用は利用規約に従ってください。</li>
      <li>問題のある投稿・作品は通報してください。通報した人の情報を晒さないでください。</li>
    </ol>
    <h2>公開範囲を確認してください</h2>
    <p>ルームへの投稿、画像、添付、制作ログは、完成作品の公開後に一般の方が閲覧できる場合があります。参加前の確認画面を読み、公開してよい内容だけを投稿してください。</p>
    <h2>通報・相談・異議申立て</h2>
    <p>投稿や作品の通報ボタンを利用してください。権利侵害・個人情報の申立て、アカウントの相談、運営の対応への異議は下記窓口で受け付けます。対象URLまたは受付番号と希望する対応をお知らせください。</p>
    <p><SupportContact /></p><LegalLinks />
  </article>
}
