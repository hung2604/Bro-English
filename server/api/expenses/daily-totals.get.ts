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

    const { data, error } = await supabase
      .from('expenses')
      .select('date, amount')
      .like('date', `${monthPrefix}%`)

    if (error) throw error

    const totalsMap = new Map<string, number>()
    data?.forEach((row: { date: string; amount: number }) => {
      const prev = totalsMap.get(row.date) || 0
      totalsMap.set(row.date, prev + Number(row.amount))
    })

    return Object.fromEntries(totalsMap)
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch expense daily totals'
    })
  }
})
