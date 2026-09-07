import { col, nextId } from '../../utils/db'
import { stripId, personNameMap } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { description, amount, date, expenseType, participantIds, paidBy } = body

  if (!description || !amount || !date || !Array.isArray(participantIds)) {
    throw createError({
      statusCode: 400,
      message: 'Description, amount, date, and participantIds are required',
    })
  }

  try {
    const expensesCol = await col('expenses')
    const participantsCol = await col('expense_participants')
    const personsCol = await col('persons')

    const now = new Date().toISOString()
    const expenseId = await nextId('expenses')
    const expense = {
      id: expenseId,
      description,
      amount: Number.parseFloat(amount),
      date,
      expense_type: expenseType || 'other',
      paid_by: paidBy ? Number.parseInt(paidBy) : null,
      created_at: now,
      updated_at: now,
    }

    await expensesCol.insertOne(expense as any)

    const participants = []
    for (const personId of participantIds) {
      const pid = typeof personId === 'number' ? personId : Number.parseInt(String(personId))
      const epId = await nextId('expense_participants')
      participants.push({
        id: epId,
        expense_id: expenseId,
        person_id: pid,
        created_at: now,
      })
    }

    if (participants.length > 0) {
      await participantsCol.insertMany(participants as any[])
    }

    const persons = await personsCol.find({}).toArray()
    const nameMap = personNameMap(persons as any)

    return {
      ...stripId(expense as any),
      participant_ids: participants.map(ep => ep.person_id),
      participant_names: participants
        .map(ep => nameMap.get(ep.person_id) || '')
        .filter(Boolean),
      paid_by_name: expense.paid_by ? nameMap.get(expense.paid_by) || null : null,
    }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to create expense',
    })
  }
})
