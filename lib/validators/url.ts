// lib/validators/url.ts

/**
 * 入力の前後空白を除去し、空なら空文字を返す。
 * （DBには空文字を入れる運用。nullable運用にしたいなら null を返す形に変えてOK）
 */
export function normalizeHttpUrlOrEmpty(v: string): string {
    const s = (v ?? '').trim()
    return s === '' ? '' : s
  }
  
  /**
   * 空ならOK。入っているなら http:// または https:// で始まること。
   */
  export function isValidHttpUrlOrEmpty(v: string): boolean {
    const s = (v ?? '').trim()
    if (s === '') return true
    return s.startsWith('https://') || s.startsWith('http://')
  }
  