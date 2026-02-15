// app/api/rooms/[roomId]/core-reject/route.ts

import { NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase/server'

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const supabase = createUserClient()
  const { requestId } = await req.json()

  await supabase
    .from('room_join_requests')
    .update({
      status: 'rejected',
      decided_at: new Date().toISOString()
    })
    .eq('id', requestId)

  return NextResponse.json({ success: true })
}
