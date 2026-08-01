import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && key)

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export async function invokeWeddingFunction(name, body) {
  if (!supabase) {
    throw new Error('Supabase no está configurado todavía.')
  }

  const { data, error } = await supabase.functions.invoke(name, { body })

  if (error) {
    throw error
  }

  return data
}
