// Only fixed public labels leave the callback. Never return provider messages or URLs.
export type CallbackStage = 'link' | 'initialize' | 'session' | 'user'
export type CallbackStatus = 'LINK_REJECTED' | 'LINK_EXPIRED' | 'LINK_USED' | 'BROWSER_STATE_MISMATCH' | 'BROWSER_STATE_MISSING' | 'NETWORK' | 'SESSION_MISSING' | 'USER_CHECK_FAILED' | 'INITIALIZATION_FAILED'

// Use only known provider error codes; descriptions and arbitrary URL values
// must never be included in UI, logs, or persisted diagnostics.
export function callbackLinkStatus(href: string): CallbackStatus {
  try {
    const url = new URL(href)
    const fragment = new URLSearchParams(url.hash.slice(1))
    const code = url.searchParams.get('error_code') || fragment.get('error_code')
    return callbackStatus('link', { code })
  } catch { return 'LINK_REJECTED' }
}

export function callbackStatus(stage: CallbackStage, error?: unknown, codeStillPresent = false): CallbackStatus {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: unknown }).code : undefined
  const name = typeof error === 'object' && error !== null && 'name' in error
    ? (error as { name?: unknown }).name : undefined
  if (code === 'otp_expired' || code === 'flow_state_expired') return 'LINK_EXPIRED'
  if (code === 'flow_state_not_found') return 'LINK_USED'
  if (code === 'bad_code_verifier') return 'BROWSER_STATE_MISMATCH'
  if (name === 'AuthRetryableFetchError' || name === 'TypeError') return 'NETWORK'
  if (stage === 'link') return 'LINK_REJECTED'
  // In this installed SDK, an unprocessed code with no session means automatic
  // PKCE initialization did not establish a session; do not call it authenticated.
  if (stage === 'session') return codeStillPresent ? 'BROWSER_STATE_MISSING' : 'SESSION_MISSING'
  if (stage === 'user') return 'USER_CHECK_FAILED'
  return 'INITIALIZATION_FAILED'
}

export const callbackMessages: Record<CallbackStatus, { code: string; text: string }> = {
  LINK_REJECTED: { code: 'AUTH-01', text: '認証サービスがリンクを受け付けませんでした。' },
  LINK_EXPIRED: { code: 'AUTH-02', text: 'リンクの有効期限が切れているか、すでに使用されています。' },
  LINK_USED: { code: 'AUTH-03', text: 'このリンクに対応する認証処理を確認できませんでした。' },
  BROWSER_STATE_MISMATCH: { code: 'AUTH-04', text: 'リンクと、登録・再設定を始めたときのブラウザの情報が一致しませんでした。' },
  BROWSER_STATE_MISSING: { code: 'AUTH-05', text: 'リンクの受け取りに必要なブラウザの情報を確認できませんでした。' },
  NETWORK: { code: 'AUTH-06', text: '認証サービスとの通信を完了できませんでした。' },
  SESSION_MISSING: { code: 'AUTH-07', text: 'リンクからログイン状態を確立できませんでした。' },
  USER_CHECK_FAILED: { code: 'AUTH-08', text: '認証後のアカウント確認を完了できませんでした。' },
  INITIALIZATION_FAILED: { code: 'AUTH-09', text: 'リンクからの認証処理を完了できませんでした。' },
}
