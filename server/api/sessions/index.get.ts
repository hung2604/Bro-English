import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { year, month } = query
  
  if (!year || !month) {
    throw createError({
      statusCode: 400,
      message: 'Year and month are required'
    })
  }

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
  
  const { data, error } = await supabase
    .from('class_sessions')
    .select('*')
    .like('date', `${monthPrefix}%`)
    .order('date')

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch sessions'
    })
  }

  return data || []
})
