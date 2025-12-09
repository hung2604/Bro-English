import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { date, year, month } = query

  try {
    let history
    if (date) {
      // Get history for a specific date
      history = db.prepare(`
        SELECT sh.*, p.name as user_name
        FROM session_history sh
        LEFT JOIN persons p ON sh.user_id = p.id
        WHERE sh.date = ?
        ORDER BY sh.created_at DESC
      `).all(date as string)
    } else if (year && month) {
      // Get history for a specific month
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
      history = db.prepare(`
        SELECT sh.*, p.name as user_name
        FROM session_history sh
        LEFT JOIN persons p ON sh.user_id = p.id
        WHERE sh.date LIKE ?
        ORDER BY sh.created_at DESC
      `).all(`${monthPrefix}%`)
    } else {
      // Get all history (limited)
      history = db.prepare(`
        SELECT sh.*, p.name as user_name
        FROM session_history sh
        LEFT JOIN persons p ON sh.user_id = p.id
        ORDER BY sh.created_at DESC
        LIMIT 100
      `).all()
    }

    return history
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch session history'
    })
  }
})

