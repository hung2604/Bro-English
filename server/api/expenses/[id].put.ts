import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const expenseId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { description, amount, date, expenseType, participantIds, paidBy } = body

  if (!expenseId || !description || !amount || !date || !Array.isArray(participantIds)) {
    throw createError({
      statusCode: 400,
      message: 'Expense ID, description, amount, date, and participantIds are required'
    })
  }

  try {
    const updateExpense = db.prepare(`
      UPDATE expenses 
      SET description = ?, amount = ?, date = ?, expense_type = ?, paid_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    const deleteParticipants = db.prepare(`
      DELETE FROM expense_participants WHERE expense_id = ?
    `)

    const insertParticipant = db.prepare(`
      INSERT INTO expense_participants (expense_id, person_id)
      VALUES (?, ?)
    `)

    const transaction = db.transaction(() => {
      // Update expense
      updateExpense.run(
        description,
        parseFloat(amount),
        date,
        expenseType || 'other',
        paidBy ? parseInt(paidBy) : null,
        parseInt(expenseId)
      )

      // Delete old participants
      deleteParticipants.run(parseInt(expenseId))

      // Add new participants
      for (const personId of participantIds) {
        insertParticipant.run(parseInt(expenseId), parseInt(personId))
      }

      // Get the updated expense with participants
      const expense = db.prepare(`
        SELECT e.*, 
               GROUP_CONCAT(ep.person_id) as participant_ids,
               GROUP_CONCAT(p.name) as participant_names,
               pb.name as paid_by_name
        FROM expenses e
        LEFT JOIN expense_participants ep ON e.id = ep.expense_id
        LEFT JOIN persons p ON ep.person_id = p.id
        LEFT JOIN persons pb ON e.paid_by = pb.id
        WHERE e.id = ?
        GROUP BY e.id
      `).get(parseInt(expenseId)) as any

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
      message: 'Failed to update expense'
    })
  }
})

