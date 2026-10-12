import { col } from '../../utils/db'
import { monthRegex, stripId, personNameMap } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { date, year, month } = query

  try {
    const historyCol = await col('session_history')
    const personsCol = await col('persons')

    let filter: Record<string, any> = {}
    let limit = 0

    if (date) {
      filter = { date: date as string }
    } else if (year && month) {
      filter = { date: monthRegex(year as string, month as string) }
    } else {
      limit = 100
    }

    let cursor = historyCol.find(filter).sort({ created_at: -1 })
    if (limit > 0) cursor = cursor.limit(limit)

    const data = await cursor.toArray()
    const persons = await personsCol.find({}).toArray()
    const nameMap = personNameMap(persons as any)

    return stripId(data).map((item: any) => ({
      ...item,
      user_name: item.source === 'agent' ? 'Zalo agent' : nameMap.get(item.user_id) || null,
    }))
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch session history',
    })
  }
})
