import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL が .env.local にありません')
if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY が .env.local にありません')

const supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const userId = process.argv[2]
const newPassword = process.argv[3]

if (!userId || !newPassword) {
  console.log('使い方: node scripts/reset-password.mjs <USER_ID> <NEW_PASSWORD>')
  process.exit(1)
}

const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
  password: newPassword,
})

if (error) {
  console.error('更新失敗:', error.message)
  process.exit(1)
}

console.log('更新成功:', data.user?.id)
