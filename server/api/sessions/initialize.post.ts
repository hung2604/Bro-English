import { col } from '../../utils/db'
import { ensureMonthSessions } from '../../utils/class-sessions'
import { monthRegex, stripId } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { year, month } = body

  if (!year || !month) {
    throw createError({
      statusCode: 400,
      message: 'Year and month are required',
    })
  }

  try {
    const sessionsCol = await col('class_sessions')
    const initialized = await ensureMonthSessions(Number(year), Number(month))
    const allSessions = await sessionsCol.find({ date: monthRegex(year, month) }).sort({ date: 1 }).toArray()

    if (initialized === 0 && allSessions.length > 0) {
      return {
        success: true,
        sessions: stripId(allSessions),
        initialized: 0,
        message: 'Month already has sessions, skipping initialization',
      }
    }

    return {
      success: true,
      sessions: stripId(allSessions),
      initialized,
    }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to initialize sessions',
    })
  }
})
