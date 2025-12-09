import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { date, year, month } = query

  try {
    let vocabulary

    if (date) {
      // Get vocabulary for a specific date
      vocabulary = db.prepare(`
        SELECT v.*, p.name as created_by_name
        FROM vocabulary v
        LEFT JOIN persons p ON v.created_by = p.id
        WHERE v.class_date = ?
        ORDER BY v.created_at DESC
      `).all(date) as any[]
    } else if (year && month) {
      // Get vocabulary for a month
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
      vocabulary = db.prepare(`
        SELECT v.*, p.name as created_by_name
        FROM vocabulary v
        LEFT JOIN persons p ON v.created_by = p.id
        WHERE v.class_date LIKE ?
        ORDER BY v.class_date DESC, v.created_at DESC
      `).all(`${monthPrefix}%`) as any[]
    } else {
      // Get all vocabulary
      vocabulary = db.prepare(`
        SELECT v.*, p.name as created_by_name
        FROM vocabulary v
        LEFT JOIN persons p ON v.created_by = p.id
        ORDER BY v.class_date DESC, v.created_at DESC
      `).all() as any[]
    }

    return vocabulary
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch vocabulary'
    })
  }
})

