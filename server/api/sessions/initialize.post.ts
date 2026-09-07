import { col, nextId } from '../../utils/db'
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
    const regex = monthRegex(year, month)

    const existingSessions = await sessionsCol.find({ date: regex }).limit(1).toArray()

    if (existingSessions.length > 0) {
      const allSessions = await sessionsCol.find({ date: regex }).sort({ date: 1 }).toArray()
      return {
        success: true,
        sessions: stripId(allSessions),
        initialized: 0,
        message: 'Month already has sessions, skipping initialization',
      }
    }

    const daysInMonth = new Date(year, month, 0).getDate()
    const now = new Date().toISOString()
    const toInsert: Array<{ date: string; has_class: number; id: number; created_at: string; updated_at: string }> = []

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const dayOfWeek = date.getDay()
      if (dayOfWeek === 1 || dayOfWeek === 4) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const id = await nextId('class_sessions')
        toInsert.push({
          id,
          date: dateStr,
          has_class: 1,
          created_at: now,
          updated_at: now,
        })
      }
    }

    if (toInsert.length > 0) {
      await sessionsCol.insertMany(toInsert as any[])
    }

    const allSessions = await sessionsCol.find({ date: regex }).sort({ date: 1 }).toArray()

    return {
      success: true,
      sessions: stripId(allSessions),
      initialized: toInsert.length,
    }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to initialize sessions',
    })
  }
})
