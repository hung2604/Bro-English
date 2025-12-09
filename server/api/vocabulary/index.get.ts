import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { date, year, month } = query

  try {
    let queryBuilder = supabase
      .from('vocabulary')
      .select(`
        *,
        persons!vocabulary_created_by_fkey(name)
      `)
      .order('class_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (date) {
      queryBuilder = queryBuilder.eq('class_date', date as string)
    } else if (year && month) {
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
      queryBuilder = queryBuilder.like('class_date', `${monthPrefix}%`)
    }

    const { data, error } = await queryBuilder

    if (error) throw error

    // Map the result to include created_by_name
    const vocabulary = (data || []).map((item: any) => ({
      ...item,
      created_by_name: item.persons?.name || null,
    }))

    return vocabulary
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch vocabulary'
    })
  }
})
