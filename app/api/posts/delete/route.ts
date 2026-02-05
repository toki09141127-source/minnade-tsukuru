import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

function userClientFromToken(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ ok: false, error: 'no token' }, { status: 401 })

  const supaUser = userClientFromToken(token)
  const { data: u } = await supaUser.auth.getUser()
  const uid = u.user?.id
  if (!uid) return NextResponse.json({ ok: false, error: 'no user' }, { status: 401 })

  const { postId } = await req.json()
  if (!postId) return NextResponse.json({ ok: false, error: 'postId required' }, { status: 400 })

  const { data: post } = await supabaseAdmin.from('posts').select('user_id').eq('id', postId).maybeSingle()
  if (!post) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  if (post.user_id !== uid) return NextResponse.json({ ok: false, error: '本人のみ削除可' }, { status: 403 })

  const { error } = await supabaseAdmin.from('posts').delete().eq('id', postId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
