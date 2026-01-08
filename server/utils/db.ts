import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables!')
  console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'MISSING')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'MISSING')
  console.error('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'MISSING')
  throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)')
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey)

// Database helper - use Supabase client directly
// All API endpoints should use supabase.from() query builder
export const db = {
  // Get Supabase client for direct access
  get client() {
    return supabase
  },
}

// Initialize default persons
async function initializeDefaultPersons() {
  const defaultPersons = ['Ania', 'Simon', 'Hairy', 'James', 'David']
  const teachers = ['Seb', 'Charlotte']
  const allPersons = [...defaultPersons, ...teachers]

  for (const name of allPersons) {
    const { error } = await supabase
      .from('persons')
      .upsert({ name, created_at: new Date().toISOString() }, { onConflict: 'name' })
    if (error && error.code !== 'PGRST116') {
      // PGRST116 means table doesn't exist - expected on first run
      console.warn(`Failed to insert person ${name}:`, error.message)
    }
  }
}

// Initialize on module load
initializeDefaultPersons().catch(console.error)

export default db
