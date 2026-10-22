// Storage paths must stay within the post's room.
export function isRoomAttachmentPath(path: string, roomId: string): boolean {
  const prefix = `rooms/${roomId}/`
  if (!path.startsWith(prefix) || /[\\\\%?#\u0000-\u001f\u007f]/.test(path)) return false
  return path.slice(prefix.length).split('/').every(segment =>
    Boolean(segment) && segment !== '.' && segment !== '..'
  )
}
