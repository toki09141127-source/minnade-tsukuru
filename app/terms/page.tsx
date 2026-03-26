import type { Metadata } from 'next'
import Link from 'next/link'
import TermsContent from '@/components/legal/TermsContent'
import PrivacyContent from '@/components/legal/PrivacyContent'

export const metadata: Metadata = {
  title: '利用規約 | みんなで作ろう（仮）',
}

type SearchParamsValue = string | string[] | undefined

type TermsPageProps = {
  searchParams?: Promise<{
    tab?: SearchParamsValue
  }>
}

function normalizeTab(tab: SearchParamsValue) {
  const value = Array.isArray(tab) ? tab[0] : tab
  return value === 'privacy' ? 'privacy' : 'terms'
}

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    padding: '10px 16px',
    borderRadius: 10,
    border: active ? '1px solid #111' : '1px solid #ccc',
    background: active ? '#111' : '#fff',
    color: active ? '#fff' : '#111',
    fontWeight: 800,
    textDecoration: 'none',
    lineHeight: 1.2,
  }
}

export default async function TermsPage({ searchParams }: TermsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeTab = normalizeTab(resolvedSearchParams?.tab)

  return (
    <div className="main">
      <h1 className="h1">利用規約</h1>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/terms" style={tabButtonStyle(activeTab === 'terms')}>
          利用規約
        </Link>
        <Link href="/terms?tab=privacy" style={tabButtonStyle(activeTab === 'privacy')}>
          プライバシーポリシー
        </Link>
      </div>

      {activeTab === 'privacy' ? (
        <div style={{ marginTop: 14 }}>
          <PrivacyContent />
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <TermsContent />
        </div>
      )}
    </div>
  )
}