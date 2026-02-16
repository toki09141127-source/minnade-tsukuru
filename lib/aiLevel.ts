// lib/aiLevel.ts
export const AI_LEVELS = ['forbidden', 'assist', 'free'] as const
export type AiLevel = (typeof AI_LEVELS)[number]

export const AI_LEVEL_LABEL: Record<AiLevel, string> = {
  forbidden: '禁止',
  assist: '補助可',
  free: '自由',
}

export function isAiLevel(v: unknown): v is AiLevel {
  return typeof v === 'string' && (AI_LEVELS as readonly string[]).includes(v)
}
