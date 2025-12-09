import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { description, amount, date, expenseType, participantIds, paidBy } = body

  if (!description || !amount || !date || !Array.isArray(participantIds)) {
    throw createError({
      statusCode: 400,
      message: 'Description, amount, date, and participantIds are required'
    })
  }

  try {
    const insertExpense = db.prepare(`
      INSERT INTO expenses (description, amount, date, expense_type, paid_by, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    const insertParticipant = db.prepare(`
      INSERT INTO expense_participants (expense_id, person_id)
      VALUES (?, ?)
    `)

    const transaction = db.transaction(() => {
      const result = insertExpense.run(
        description,
        parseFloat(amount),
        date,
        expenseType || 'other',
        paidBy ? parseInt(paidBy) : null
      )
      const expenseId = result.lastInsertRowid

      for (const personId of participantIds) {
        insertParticipant.run(expenseId, parseInt(personId))
      }

      // Get the created expense with participants
      const expense = db.prepare(`
        SELECT e.*, 
               GROUP_CONCAT(ep.person_id) as participant_ids,
               GROUP_CONCAT(p.name) as participant_names
        FROM expenses e
        LEFT JOIN expense_participants ep ON e.id = ep.expense_id
        LEFT JOIN persons p ON ep.person_id = p.id
        WHERE e.id = ?
        GROUP BY e.id
      `).get(expenseId) as any

      return expense
    })

    const expense = transaction() as any

    return {
      ...expense,
      participant_ids: expense.participant_ids ? expense.participant_ids.split(',').map(Number) : [],
      participant_names: expense.participant_names ? expense.participant_names.split(',') : []
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create expense'
    })
  }
})

