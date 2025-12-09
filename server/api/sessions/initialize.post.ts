import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { year, month } = body

  if (!year || !month) {
    throw createError({
      statusCode: 400,
      message: 'Year and month are required'
    })
  }

  try {
    const insert = db.prepare(`
      INSERT INTO class_sessions (date, has_class, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(date) 
      DO NOTHING
    `)

    const transaction = db.transaction(() => {
      const daysInMonth = new Date(year, month, 0).getDate()
      const sessions: Array<{ date: string }> = []

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day)
        const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
        
        // Monday (1) or Thursday (4) - default to has_class = 1
        if (dayOfWeek === 1 || dayOfWeek === 4) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          insert.run(dateStr, 1)
          sessions.push({ date: dateStr })
        }
      }

      return sessions
    })

    const sessions = transaction()
    
    // Return all sessions for the month (global)
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
    const allSessions = db.prepare(`
      SELECT * FROM class_sessions 
      WHERE date LIKE ?
      ORDER BY date
    `).all(monthPrefix)

    return { success: true, sessions: allSessions, initialized: sessions.length }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to initialize sessions'
    })
  }
})

