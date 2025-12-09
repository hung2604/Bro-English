import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, date, hasClass } = body

  if (!userId || !date) {
    throw createError({
      statusCode: 400,
      message: 'User ID and date are required'
    })
  }

  try {
    // Get existing session to track history
    const existingSession = db.prepare(`
      SELECT * FROM class_sessions 
      WHERE date = ?
    `).get(date) as { has_class: number } | undefined
    
    const previousHasClass = existingSession ? existingSession.has_class : null
    const hasClassValue = hasClass ? 1 : 0
    
    // Only save history if there's a change
    if (previousHasClass !== hasClassValue) {
      const insertHistory = db.prepare(`
        INSERT INTO session_history (user_id, date, has_class, previous_has_class)
        VALUES (?, ?, ?, ?)
      `)
      insertHistory.run(parseInt(userId), date, hasClassValue, previousHasClass)
    }
    
    // Update or insert session (global, no person_id)
    const insert = db.prepare(`
      INSERT INTO class_sessions (date, has_class, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(date) 
      DO UPDATE SET has_class = ?, updated_at = CURRENT_TIMESTAMP
    `)
    
    insert.run(date, hasClassValue, hasClassValue)
    
    const session = db.prepare(`
      SELECT * FROM class_sessions 
      WHERE date = ?
    `).get(date)
    
    return session
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to save session'
    })
  }
})

