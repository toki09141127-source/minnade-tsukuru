import OwnerCoreRequestsPanel from './OwnerCoreRequestsPanel'

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params

  return (
    <div>
      {/* 既存のルーム詳細UI */}

      {/* 追加：オーナー専用申請パネル */}
      <OwnerCoreRequestsPanel roomId={roomId} />
    </div>
  )
}
