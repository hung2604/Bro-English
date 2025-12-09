import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { year, month } = query

  try {
    let expenses
    if (year && month) {
      // Get expenses for a specific month
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
      expenses = db.prepare(`
        SELECT e.*, 
               GROUP_CONCAT(ep.person_id) as participant_ids,
               GROUP_CONCAT(p.name) as participant_names,
               pb.name as paid_by_name
        FROM expenses e
        LEFT JOIN expense_participants ep ON e.id = ep.expense_id
        LEFT JOIN persons p ON ep.person_id = p.id
        LEFT JOIN persons pb ON e.paid_by = pb.id
        WHERE e.date LIKE ?
        GROUP BY e.id
        ORDER BY e.date DESC, e.created_at DESC
      `).all(`${monthPrefix}%`)
    } else {
      // Get all expenses
      expenses = db.prepare(`
        SELECT e.*, 
               GROUP_CONCAT(ep.person_id) as participant_ids,
               GROUP_CONCAT(p.name) as participant_names,
               pb.name as paid_by_name
        FROM expenses e
        LEFT JOIN expense_participants ep ON e.id = ep.expense_id
        LEFT JOIN persons p ON ep.person_id = p.id
        LEFT JOIN persons pb ON e.paid_by = pb.id
        GROUP BY e.id
        ORDER BY e.date DESC, e.created_at DESC
        LIMIT 100
      `).all()
    }

    // Parse participant data
    return expenses.map((expense: any) => ({
      ...expense,
      participant_ids: expense.participant_ids ? expense.participant_ids.split(',').map(Number) : [],
      participant_names: expense.participant_names ? expense.participant_names.split(',') : []
    }))
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch expenses'
    })
  }
})

