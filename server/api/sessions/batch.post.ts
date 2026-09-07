import { col, nextId } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { personId, sessions } = body

  if (!personId || !Array.isArray(sessions)) {
    throw createError({
      statusCode: 400,
      message: 'Person ID and sessions array are required',
    })
  }

  try {
    const classSessions = await col('class_sessions')
    const now = new Date().toISOString()

    for (const session of sessions as Array<{ date: string; hasClass: boolean }>) {
      const existing = await classSessions.findOne({ date: session.date })
      if (existing) {
        await classSessions.updateOne(
          { date: session.date },
          { $set: { has_class: session.hasClass ? 1 : 0, updated_at: now } },
        )
      } else {
        const id = await nextId('class_sessions')
        await classSessions.insertOne({
          id,
          date: session.date,
          has_class: session.hasClass ? 1 : 0,
          created_at: now,
          updated_at: now,
        } as any)
      }
    }

    return { success: true, count: sessions.length }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to save sessions',
    })
  }
})
