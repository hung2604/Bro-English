import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { personId, sessions } = body

  if (!personId || !Array.isArray(sessions)) {
    throw createError({
      statusCode: 400,
      message: 'Person ID and sessions array are required'
    })
  }

  const insert = db.prepare(`
    INSERT INTO class_sessions (person_id, date, has_class, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(person_id, date) 
    DO UPDATE SET has_class = ?, updated_at = CURRENT_TIMESTAMP
  `)

  const transaction = db.transaction((sessions: Array<{ date: string; hasClass: boolean }>) => {
    for (const session of sessions) {
      const hasClassValue = session.hasClass ? 1 : 0
      insert.run(parseInt(personId), session.date, hasClassValue, hasClassValue)
    }
  })

  try {
    transaction(sessions)
    return { success: true, count: sessions.length }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to save sessions'
    })
  }
})

