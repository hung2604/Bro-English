import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { date, year, month } = query

  try {
    let queryBuilder = supabase
      .from('session_history')
      .select(`
        *,
        persons!session_history_user_id_fkey(name)
      `)
      .order('created_at', { ascending: false })

    if (date) {
      queryBuilder = queryBuilder.eq('date', date as string)
    } else if (year && month) {
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
      queryBuilder = queryBuilder.like('date', `${monthPrefix}%`)
    } else {
      queryBuilder = queryBuilder.limit(100)
    }

    const { data, error } = await queryBuilder

    if (error) throw error

    // Map the result to include user_name
    const history = (data || []).map((item: any) => ({
      ...item,
      user_name: item.persons?.name || null,
    }))

    return history
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch session history'
    })
  }
})
