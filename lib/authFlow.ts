import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from './legalVersions'
export function authCallbackUrl(origin: string, recovery = false) {
  return new URL('/auth/callback' + (recovery ? '?next=reset-password' : ''), origin).toString()
}
export function signupOptions(origin: string) {
  return { emailRedirectTo: authCallbackUrl(origin), data: {
    adult_declared: true, terms_version: CURRENT_TERMS_VERSION, privacy_version: CURRENT_PRIVACY_VERSION,
  } }
}
export function callbackDestination(href: string) {
  const url = new URL(href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  if (url.searchParams.has('error') || fragment.has('error')) return null
  return url.searchParams.get('next') === 'reset-password' || fragment.get('type') === 'recovery'
    ? '/auth/reset-password' : '/'
}
export function passwordError(password: string, confirmation: string) {
  if (password.length < 8) return '新しいパスワードは8文字以上にしてください。'
  if (password !== confirmation) return '確認用パスワードが一致しません。'
  return ''
}
