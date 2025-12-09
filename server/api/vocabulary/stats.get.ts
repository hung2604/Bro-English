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

  try {
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
    
    // Get vocabulary count per date for the month
    const stats = db.prepare(`
      SELECT class_date, COUNT(*) as count
      FROM vocabulary
      WHERE class_date LIKE ?
      GROUP BY class_date
      ORDER BY class_date
    `).all(`${monthPrefix}%`) as Array<{ class_date: string; count: number }>

    // Convert to map for easy lookup
    const statsMap = new Map<string, number>()
    stats.forEach(stat => {
      statsMap.set(stat.class_date, stat.count)
    })

    return Object.fromEntries(statsMap)
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch vocabulary stats'
    })
  }
})

