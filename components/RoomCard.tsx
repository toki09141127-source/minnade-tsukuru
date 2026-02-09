// components/RoomCard.tsx
import Link from 'next/link'

type RoomCardProps = {
  href: string
  title: string
  status: string
  category: string
  memberCount: number
  likeCount: number
  remainingLabel: string
  createdLabel: string
}

function statusLabel(status: string) {
  if (status === 'open') return 'open'
  if (status === 'forced_publish') return 'forced_publish'
  if (status === 'closed') return 'closed'
  return status
}

function statusClass(status: string) {
  if (status === 'open') return 'badgeStatus badgeStatusOpen'
  if (status === 'forced_publish') return 'badgeStatus badgeStatusForced'
  if (status === 'closed') return 'badgeStatus badgeStatusClosed'
  return 'badgeStatus'
}

export default function RoomCard(props: RoomCardProps) {
  const {
    href,
    title,
    status,
    category,
    memberCount,
    likeCount,
    remainingLabel,
    createdLabel,
  } = props

  return (
    <Link href={href} className="roomCardLink" style={{ textDecoration: 'none' }}>
      <div className="roomCard" data-noinvert>
        <div className="roomCardTop">
          <div className="badges">
            <span className={`badge ${statusClass(status)}`}>{statusLabel(status)}</span>
            <span className="badge badgeCategory">{category}</span>
          </div>
        </div>

        <div className="roomCardTitle" data-noinvert-text>
          {title}
        </div>

        <div className="roomCardMeta" data-noinvert-text>
          <div className="metaItem">
            <span className="metaIcon" aria-hidden>👥</span>
            <span className="metaText">参加者：{memberCount}</span>
          </div>

          <div className="metaItem">
            <span className="metaIcon" aria-hidden>💗</span>
            <span className="metaText">いいね：{likeCount}</span>
          </div>

          <div className="metaItem">
            <span className="metaIcon" aria-hidden>⏳</span>
            <span className="metaText">残り：{remainingLabel}</span>
          </div>

          {/* ← ここが壊れてた */}
          <div className="metaItem">
            <span className="metaIcon" aria-hidden>🕒</span>
            <span className="metaText">作成：{createdLabel}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
