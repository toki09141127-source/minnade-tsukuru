export type WorkBlock = { id: string; kind: 'title' | 'summary' | 'text' | 'image' | 'notes' | 'log'; text?: string; postId?: string }
export type PublicLog = { id: string; roomId: string; content: string; hidden: boolean; deleted: boolean; excluded: boolean; reviewed: boolean }
export function piiSignals(text: string): string[] {
  const value = text.normalize('NFKC')
  const rules: [string, RegExp][] = [
    ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
    ['phone', /(?:\+81[-\s]?|0)\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/],
    ['address', /(?:〒\s*\d{3}-?\d{4}|(?:都|道|府|県).{0,12}(?:市|区|町|村).{0,15}\d+丁目)/],
    ['social', /(?:@[a-z0-9_]{2,}|(?:instagram\.com|x\.com|twitter\.com)\/[^\s]+)/i],
  ]
  return rules.filter(([,pattern])=>pattern.test(value)).map(([name])=>name)
}
export function safePublicLogs(roomId: string, logs: PublicLog[]) {
  return logs.filter(log=>log.roomId===roomId && !log.hidden && !log.deleted && !log.excluded &&
    log.reviewed && piiSignals(log.content).length===0)
}
export interface CompletionProvider {
  // Must be local/mock until provider terms and explicit transmission consent are verified.
  summarize(input: { roomId: string; logs: PublicLog[]; draft: WorkBlock[] }): Promise<WorkBlock[]>
}
export async function buildCompletion(roomId: string, logs: PublicLog[], draft: WorkBlock[], provider?: CompletionProvider) {
  const safeLogs = safePublicLogs(roomId, logs)
  const safeDraft = draft.filter(block=>!piiSignals(block.text ?? '').length &&
    (!block.postId || safeLogs.some(log=>log.id===block.postId)))
  if (safeDraft.some(block=>block.kind==='text' && block.text?.trim())) return { blocks:safeDraft, generated:false }
  if (provider) {
    try {
      const generated=await provider.summarize({roomId,logs:safeLogs,draft:safeDraft})
      if (generated.length>0 && generated.length<=50 && generated.every(block=>(block.text?.length ?? 0)<=20000 &&
        !piiSignals(block.text ?? '').length && (!block.postId || safeLogs.some(log=>log.id===block.postId))))
        return {blocks:generated,generated:true}
    } catch { /* fall back without exposing provider diagnostics */ }
  }
  return {blocks:[{id:'incomplete',kind:'text' as const,text:'完成作品の内容は未確定です。公開可能な制作ログを確認してください。'}],generated:false}
}
