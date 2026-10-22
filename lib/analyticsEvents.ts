export const EVENT_NAMES = ['signup','login','room_created','room_viewed','room_joined','core_requested','first_post','attachment_uploaded','highlighted','ai_called','ai_posted','human_post_after_ai','work_published','production_log_viewed','like','repeat_visit'] as const
export type AnalyticsEvent = {
  id: string
  name: typeof EVENT_NAMES[number]
  occurredAt: string
  actorType: 'human' | 'ai' | 'system'
  // IDs must be pseudonymous. No arbitrary properties or user text.
  actorRef?: string
  roomRef?: string
}
export interface AnalyticsSink { record(event: AnalyticsEvent): Promise<void> }
export const disabledAnalytics: AnalyticsSink = { async record() {} }
