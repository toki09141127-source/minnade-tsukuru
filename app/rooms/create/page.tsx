import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import RoomCreateClient from './RoomCreateClient'

export default async function RoomCreatePage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data?.user) redirect('/login')

  return <RoomCreateClient />
}
