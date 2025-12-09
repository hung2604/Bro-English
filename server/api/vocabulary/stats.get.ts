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

  try {
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`

    // Get vocabulary count per date for the month
    // Supabase doesn't support GROUP BY directly in select, so we'll fetch all and group in code
    const { data, error } = await supabase
      .from('vocabulary')
      .select('class_date')
      .like('class_date', `${monthPrefix}%`)

    if (error) throw error

    // Group by date
    const statsMap = new Map<string, number>()
    data?.forEach((item: any) => {
      const count = statsMap.get(item.class_date) || 0
      statsMap.set(item.class_date, count + 1)
    })

    return Object.fromEntries(statsMap)
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch vocabulary stats'
    })
  }
})
