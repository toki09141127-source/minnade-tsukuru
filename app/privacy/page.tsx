import type { Metadata } from 'next'
import PrivacyContent from '@/components/legal/PrivacyContent'

export const metadata: Metadata = {
  title: 'プライバシーポリシー | みんなで作ろう（仮）',
}

export default function PrivacyPage() {
  return (
    <div className="main">
      <h1 className="h1">プライバシーポリシー</h1>
      <PrivacyContent />
    </div>
  )
}