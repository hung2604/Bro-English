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
    const vocabCol = await col('vocabulary')
    const data = await vocabCol
      .find({ class_date: monthRegex(year as string, month as string) })
      .project({ class_date: 1 })
      .toArray()

    const statsMap = new Map<string, number>()
    data.forEach((item: any) => {
      const count = statsMap.get(item.class_date) || 0
      statsMap.set(item.class_date, count + 1)
    })

    return Object.fromEntries(statsMap)
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch vocabulary stats',
    })
  }
})
