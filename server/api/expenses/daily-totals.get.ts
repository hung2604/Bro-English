import { col } from '../../utils/db'
import { monthRegex } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { year, month } = query

  if (!year || !month) {
    throw createError({
      statusCode: 400,
      message: 'Year and month are required',
    })
  }

  try {
    const expensesCol = await col('expenses')
    const data = await expensesCol
      .find({ date: monthRegex(year as string, month as string) })
      .project({ date: 1, amount: 1 })
      .toArray()

    const totalsMap = new Map<string, number>()
    data.forEach((row: any) => {
      const prev = totalsMap.get(row.date) || 0
      totalsMap.set(row.date, prev + Number(row.amount))
    })

    return Object.fromEntries(totalsMap)
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch expense daily totals',
    })
  }
})
