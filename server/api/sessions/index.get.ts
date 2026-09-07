import { col } from '../../utils/db'
import { monthRegex, stripId } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { year, month } = query

  if (!year || !month) {
    throw createError({
      statusCode: 400,
      message: 'Year and month are required',
    })
  }

  const sessions = await col('class_sessions')
  const data = await sessions
    .find({ date: monthRegex(year as string, month as string) })
    .sort({ date: 1 })
    .toArray()

  return stripId(data)
})
