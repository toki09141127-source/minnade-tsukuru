// A signup or recovery email may be previewed before it is opened. Never follow its
// one-time verification URL until the person presses the confirmation button.
export type EmailConfirmation = { kind: 'signup' | 'recovery'; url: string }

export function emailConfirmationTarget(href: string, authBase: string | undefined): EmailConfirmation | null {
  try {
    const page = new URL(href)
    if (page.pathname !== '/auth/confirm' || page.search || page.username || page.password) return null
    if (page.protocol !== 'https:' && !(page.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(page.hostname))) return null
    const fragment = new URLSearchParams(page.hash.slice(1))
    if ([...fragment.keys()].length !== 1) return null
    const key = fragment.has('signup_token') ? 'signup_token' : 'recovery_token'
    if (!fragment.has(key)) return null
    const kind = key === 'signup_token' ? 'signup' : 'recovery'
    const configured = new URL(authBase || '')
    if (configured.protocol !== 'https:' || configured.username || configured.password || configured.pathname !== '/' || configured.search || configured.hash) return null
    const token = fragment.get(key) || ''
    if (!/^[A-Za-z0-9_-]{32,1024}$/.test(token)) return null
    // Build both destinations from trusted configuration/current origin. The
    // incoming fragment cannot supply an auth host, redirect URL, or arbitrary flow type.
    const verify = new URL('/auth/v1/verify', configured.origin)
    verify.search = new URLSearchParams({ token, type: kind, redirect_to: page.origin + '/auth/callback' + (kind === 'recovery' ? '?next=reset-password' : '') }).toString()
    return { kind, url: verify.href }
  } catch { return null }
}

// Preserve the existing recovery-only contract.
export function recoveryConfirmationUrl(href: string, authBase: string | undefined): string | null {
  const target = emailConfirmationTarget(href, authBase)
  return target?.kind === 'recovery' ? target.url : null
}
