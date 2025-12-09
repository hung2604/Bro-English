import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { year, month } = query
  
  if (!year || !month) {
    throw createError({
      statusCode: 400,
      message: 'Year and month are required'
    })
  }

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
  
  const sessions = db.prepare(`
    SELECT * FROM class_sessions 
    WHERE date LIKE ?
    ORDER BY date
  `).all(monthPrefix)

  return sessions
})

