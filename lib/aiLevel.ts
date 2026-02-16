export const AI_LEVELS = ['forbidden', 'assist', 'free'] as const
export type AiLevel = (typeof AI_LEVELS)[number]

// UI表示（短いラベル）
export const AI_LEVEL_LABEL: Record<AiLevel, string> = {
  forbidden: 'AI禁止',
  assist: 'AI補助可',
  free: 'AI自由',
}

// UIヘルプ（説明文）
export const AI_LEVEL_HELP: Record<AiLevel, string> = {
  forbidden: 'AIは使わない（人力のみ）',
  assist: 'アイデア出し・壁打ち程度で使用',
  free: 'かなりAIを活用して制作する',
}

// select用（value/label/help をここから供給）
export const AI_LEVEL_OPTIONS: { value: AiLevel; label: string; help: string }[] = AI_LEVELS.map(
  (v) => ({
    value: v,
    label: AI_LEVEL_LABEL[v],
    help: AI_LEVEL_HELP[v],
  })
)

export function isAiLevel(v: unknown): v is AiLevel {
  return typeof v === 'string' && (AI_LEVELS as readonly string[]).includes(v)
}

// API側で「不正値はDB defaultに寄せる」用
export function normalizeAiLevel(v: unknown, fallback: AiLevel = 'assist'): AiLevel {
  return isAiLevel(v) ? v : fallback
}
