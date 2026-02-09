import WorksListClient from './WorksListClient'

export const dynamic = 'force-dynamic'

export default function WorksPage() {
  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>完成作品</h1>
      <p style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
        forced_publish（または終了）になったルームを一覧表示します。
      </p>

      <WorksListClient />
    </div>
  )
}
