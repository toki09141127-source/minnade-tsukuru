export const MAX_UPLOAD_BYTES = 4_000_000
const allowed: Record<string, { ext: string; names: string[]; folder: string }> = {
  'image/png': { ext: 'png', names: ['png'], folder: 'images' },
  'image/jpeg': { ext: 'jpg', names: ['jpg', 'jpeg'], folder: 'images' },
  'image/gif': { ext: 'gif', names: ['gif'], folder: 'images' },
  'image/webp': { ext: 'webp', names: ['webp'], folder: 'images' },
  'video/mp4': { ext: 'mp4', names: ['mp4'], folder: 'videos' },
  'video/webm': { ext: 'webm', names: ['webm'], folder: 'videos' },
  'application/pdf': { ext: 'pdf', names: ['pdf'], folder: 'files' },
  'text/plain': { ext: 'txt', names: ['txt'], folder: 'files' },
}
export function validateUpload(name: string, mime: string, bytes: Uint8Array) {
  const rule = allowed[mime]
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (!rule || !rule.names.includes(ext) || bytes.length < 1 || bytes.length > MAX_UPLOAD_BYTES) return null
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value)
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length))
  const valid = mime === 'image/png' ? starts(137,80,78,71,13,10,26,10)
    : mime === 'image/jpeg' ? starts(255,216,255)
    : mime === 'image/gif' ? ['GIF87a','GIF89a'].includes(ascii(0,6))
    : mime === 'image/webp' ? ascii(0,4)==='RIFF' && ascii(8,4)==='WEBP'
    : mime === 'video/mp4' ? ascii(4,4)==='ftyp'
    : mime === 'video/webm' ? starts(26,69,223,163)
    : mime === 'application/pdf' ? ascii(0,5)==='%PDF-'
    : mime === 'text/plain' ? !bytes.includes(0) && !starts(77,90) && (() => {
      try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return true } catch { return false }
    })() : false
  return valid ? rule : null
}
