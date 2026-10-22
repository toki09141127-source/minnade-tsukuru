import Link from 'next/link'
import { SUPPORT_EMAIL } from '@/lib/supportContact'
export default function SupportContact() {
  return <span>個人情報・権利侵害・アカウント等のお問い合わせ：<a href={'mailto:'+SUPPORT_EMAIL} style={{overflowWrap:'anywhere'}}>{SUPPORT_EMAIL}</a>（パスワードや認証コードは送らないでください） · <Link href="/guidelines">利用案内・通報について</Link></span>
}
