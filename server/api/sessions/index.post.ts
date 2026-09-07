import { col, nextId } from '../../utils/db'
import { stripId } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, date, hasClass } = body

  if (!userId || !date) {
    throw createError({
      statusCode: 400,
      message: 'User ID and date are required',
    })
  }

  try {
    const sessions = await col('class_sessions')
    const history = await col('session_history')

    const existingSession = await sessions.findOne({ date })
    const previousHasClass = existingSession ? existingSession.has_class : null
    const hasClassValue = hasClass ? 1 : 0

    if (previousHasClass !== hasClassValue) {
      const historyId = await nextId('session_history')
      await history.insertOne({
        id: historyId,
        user_id: Number.parseInt(userId),
        date,
        has_class: hasClassValue,
        previous_has_class: previousHasClass,
        created_at: new Date().toISOString(),
      } as any)
    }

    const now = new Date().toISOString()
    if (existingSession) {
      await sessions.updateOne(
        { date },
        { $set: { has_class: hasClassValue, updated_at: now } },
      )
      const updated = await sessions.findOne({ date })
      return stripId(updated!)
    }

    const id = await nextId('class_sessions')
    const doc = {
      id,
      date,
      has_class: hasClassValue,
      created_at: now,
      updated_at: now,
    }
    await sessions.insertOne(doc as any)
    return stripId(doc as any)
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to save session',
    })
  }
})
