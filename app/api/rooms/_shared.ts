import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type RoomConsentPayload = {
  roomTermsVersion: string
  roomAgreedAt: string
  forcedPublishAckAt: string
  coreLockAgreedAt?: string | null
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

export function jsonOk(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data })
}

export async function requireApiUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    throw new Error('認証トークンがありません')
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    throw new Error('認証に失敗しました')
  }

  return data.user
}

export function parseConsent(
  input: any,
  options?: { requireCoreLock?: boolean }
): RoomConsentPayload {
  const requireCoreLock = options?.requireCoreLock ?? false

  if (!input || typeof input !== 'object') {
    throw new Error('同意情報が不正です')
  }

  const roomTermsVersion =
    typeof input.roomTermsVersion === 'string' ? input.roomTermsVersion.trim() : ''
  const roomAgreedAt =
    typeof input.roomAgreedAt === 'string' ? input.roomAgreedAt.trim() : ''
  const forcedPublishAckAt =
    typeof input.forcedPublishAckAt === 'string' ? input.forcedPublishAckAt.trim() : ''
  const coreLockAgreedAt =
    typeof input.coreLockAgreedAt === 'string' ? input.coreLockAgreedAt.trim() : null

  if (!roomTermsVersion || !roomAgreedAt || !forcedPublishAckAt) {
    throw new Error('ルーム参加同意情報が不足しています')
  }

  if (requireCoreLock && !coreLockAgreedAt) {
    throw new Error('core参加同意情報が不足しています')
  }

  return {
    roomTermsVersion,
    roomAgreedAt,
    forcedPublishAckAt,
    coreLockAgreedAt,
  }
}

export async function fetchRoom(roomId: string) {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select(
      'id, status, created_by, enable_core_approval, enable_core_invite, core_invite_code, deleted_at'
    )
    .eq('id', roomId)
    .maybeSingle()

  if (error) throw error
  return data
}