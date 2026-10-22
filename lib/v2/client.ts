import { supabase } from '@/lib/supabase/client'
export async function v2Request(operation:string,body?:unknown,query?:URLSearchParams){
 const {data}=await supabase.auth.getSession(),headers:Record<string,string>={};if(data.session)headers.Authorization='Bearer '+data.session.access_token
 if(body)headers['Content-Type']='application/json'
 const response=await fetch('/api/v2/'+operation+(query?'?'+query.toString():''),{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,cache:'no-store'})
 const result=await response.json();if(!response.ok)throw new Error(result.error??'処理できませんでした。');return result
}
