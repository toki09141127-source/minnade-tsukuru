import { AI_LEVEL_LABEL, type AiLevel } from '@/lib/aiLevel'

export default function AiLevelBadge({ level }: { level: AiLevel }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: '1px solid rgba(0,0,0,0.08)',
        background: 'rgba(0,0,0,0.05)',
      }}
    >
      AI: {AI_LEVEL_LABEL[level]}
    </span>
  )
}
