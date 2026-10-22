import type { PlannedPromotion } from './promotionPlanner'

export const BUFFER_CHANNEL = '6ad9a93b778b240e2f8816f0'
type Transport = typeof fetch
export type SendResult = {
  state: 'succeeded' | 'failed' | 'unknown'
  code: 'BUFFER_ACCEPTED' | 'ACCESS_DENIED' | 'REJECTED' | 'AMBIGUOUS'
  id?: string
  dueAt?: string
}
const channelQuery = 'query { channel(input: { id: "6ad9a93b778b240e2f8816f0" }) { id name service isDisconnected isLocked isQueuePaused } }'
const mutation = 'mutation MinntukuSchedule($input: CreatePostInput!) { createPost(input: $input) { __typename ... on PostActionSuccess { post { id dueAt status } } ... on MutationError { message } } }'

export function createBufferSender(key: string, transport: Transport = fetch) {
  const request = (query: string, variables?: unknown) => transport('https://api.buffer.com', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ query, variables }), cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  })
  return {
    async preflight(): Promise<boolean> {
      if (!key) return false
      try {
        const response = await request(channelQuery)
        if (!response.ok) return false
        const b = await response.json()
        if (b.errors !== undefined && (!Array.isArray(b.errors) || b.errors.length)) return false
        const c = b.data?.channel
        return c?.id === BUFFER_CHANNEL && c.service === 'twitter' &&
          typeof c.name === 'string' && c.name.replace(/^@/, '').toLowerCase() === 'minnade_tsukuru' &&
          c.isDisconnected === false && c.isLocked === false && c.isQueuePaused === false
      } catch { return false }
    },
    async inspect(id: string, p: PlannedPromotion): Promise<{
      state: 'scheduled' | 'sent' | 'failed' | 'unknown' | 'publishing' | 'missing' | 'mismatch' | 'held'; sentAt?: string; externalUrl?: string; cancellable?: boolean
    }> {
      if (!key || !/^[a-zA-Z0-9_-]{1,150}$/.test(id)) return { state: 'unknown' }
      try {
        const response = await request('query MinntukuReceipt($input: PostInput!) { post(input: $input) { id channelId channelService text dueAt status sentAt externalLink allowedActions } }', { input: { id } })
        if (!response.ok) return { state: 'unknown' }
        const b = await response.json()
        if (Array.isArray(b.errors) && b.errors.length === 1 && b.errors[0]?.extensions?.code === 'NOT_FOUND' &&
            Array.isArray(b.errors[0]?.path) && b.errors[0].path.length === 1 && b.errors[0].path[0] === 'post' && !b.data?.post) return { state: 'missing' }
        if (b.errors !== undefined && (!Array.isArray(b.errors) || b.errors.length)) return { state: 'unknown' }
        const post = b.data?.post
        if (b.data && post === null) return { state: 'missing' }
        if (post?.id !== id || post.channelId !== BUFFER_CHANNEL || post.channelService !== 'twitter' || post.text !== p.text) return { state: 'mismatch' }
        if (post.status === 'scheduled' && Date.parse(post.dueAt) === Date.parse(p.dueAt)) return { state: 'scheduled', cancellable: Array.isArray(post.allowedActions) && post.allowedActions.includes('deletePost') }
        if (post.status === 'draft') return { state: 'held', cancellable: Array.isArray(post.allowedActions) && post.allowedActions.includes('deletePost') }
        if (post.status === 'sending') return { state: 'publishing' }
        if (post.status === 'error') return { state: 'failed' }
        // Numeric account URL verified against the official X profile during staging acceptance.
        const externalUrl = typeof post.externalLink === 'string'
          ? post.externalLink.replace(new RegExp('^https://x[.]com/2021180454695731201/status/([0-9]+)$'), 'https://x.com/minnade_tsukuru/status/$1')
          : null
        if (post.status === 'sent' && typeof post.sentAt === 'string' &&
            Number.isFinite(Date.parse(post.sentAt)) && Date.parse(post.sentAt) <= Date.now() + 60_000 &&
            typeof externalUrl === 'string' &&
            new RegExp('^https://(x[.]com|twitter[.]com)/minnade_tsukuru/status/[0-9]+$').test(externalUrl)) {
          return { state: 'sent', sentAt: post.sentAt, externalUrl }
        }
        return { state: 'unknown' }
      } catch { return { state: 'unknown' } }
    },
    async release(id: string): Promise<'released' | 'unknown'> {
      if (!key || !/^[a-zA-Z0-9_-]{1,150}$/.test(id)) return 'unknown'
      try {
        const r = await request('mutation MinntukuRelease($input: EditPostInput!) { editPost(input: $input) { __typename ... on PostActionSuccess { post { id } } ... on MutationError { message } } }',
          {input:{id,mode:'shareNow',schedulingType:'automatic',saveToDraft:false}})
        if (!r.ok) return 'unknown'
        const b = await r.json()
        if (b.errors !== undefined && (!Array.isArray(b.errors) || b.errors.length)) return 'unknown'
        return b.data?.editPost?.__typename === 'PostActionSuccess' && b.data.editPost.post?.id === id ? 'released' : 'unknown'
      } catch { return 'unknown' }
    },
    async cancel(id: string): Promise<'cancelled' | 'unknown'> {
      if (!key || !/^[a-zA-Z0-9_-]{1,150}$/.test(id)) return 'unknown'
      try {
        const r = await request('mutation MinntukuCancel($input: DeletePostInput!) { deletePost(input: $input) { __typename ... on DeletePostSuccess { id } } }', { input: { id } })
        if (!r.ok) return 'unknown'
        const b = await r.json()
        if (b.errors !== undefined && (!Array.isArray(b.errors) || b.errors.length)) return 'unknown'
        const result = b.data?.deletePost
        return result?.__typename === 'DeletePostSuccess' && result.id === id ? 'cancelled' : 'unknown'
      } catch { return 'unknown' }
    },
    async send(p: PlannedPromotion, hold = true): Promise<SendResult> {
      if (!key) return { state: 'failed', code: 'ACCESS_DENIED' }
      try {
        const response = await request(mutation, { input: {
          channelId: BUFFER_CHANNEL, text: p.text, dueAt: p.dueAt,
          mode: 'customScheduled', schedulingType: 'automatic',
          assets: [], needsApproval: false, saveToDraft: hold,
        } })
        // Do not infer "not created" from 429, 5xx, malformed or partial replies.
        if (response.status === 401 || response.status === 403) return { state: 'failed', code: 'ACCESS_DENIED' }
        if (!response.ok) return { state: 'unknown', code: 'AMBIGUOUS' }
        const b = await response.json()
        if (b.errors !== undefined && (!Array.isArray(b.errors) || b.errors.length)) return { state: 'unknown', code: 'AMBIGUOUS' }
        const result = b.data?.createPost
        if (result?.__typename === 'PostActionSuccess' &&
            typeof result.post?.id === 'string' && /^[a-zA-Z0-9_-]{1,150}$/.test(result.post.id) &&
            ((hold && result.post.dueAt == null) || (typeof result.post.dueAt === 'string' &&
            Date.parse(result.post.dueAt) === Date.parse(p.dueAt)))) {
          return { state: 'succeeded', code: 'BUFFER_ACCEPTED', id: result.post.id, dueAt: p.dueAt }
        }
        if (result?.__typename !== 'PostActionSuccess' && typeof result?.message === 'string') {
          return { state: 'failed', code: 'REJECTED' }
        }
        return { state: 'unknown', code: 'AMBIGUOUS' }
      } catch { return { state: 'unknown', code: 'AMBIGUOUS' } }
    },
  }
}
