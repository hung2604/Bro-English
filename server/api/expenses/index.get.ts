import { col } from '../../utils/db'
import { monthRegex, stripId, personNameMap } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { year, month } = query

  try {
    const expensesCol = await col('expenses')
    const participantsCol = await col('expense_participants')
    const personsCol = await col('persons')

    let filter: Record<string, any> = {}
    let limit = 0

    if (year && month) {
      filter = { date: monthRegex(year as string, month as string) }
    } else {
      limit = 100
    }

    let cursor = expensesCol.find(filter).sort({ date: -1, created_at: -1 })
    if (limit > 0) cursor = cursor.limit(limit)

    const expenses = await cursor.toArray()
    const persons = await personsCol.find({}).toArray()
    const nameMap = personNameMap(persons as any)

    const expenseIds = expenses.map((e: any) => e.id)
    const allParticipants = expenseIds.length > 0
      ? await participantsCol.find({ expense_id: { $in: expenseIds } }).toArray()
      : []

    const participantsByExpense = new Map<number, any[]>()
    for (const ep of allParticipants) {
      const list = participantsByExpense.get(ep.expense_id) || []
      list.push(ep)
      participantsByExpense.set(ep.expense_id, list)
    }

    return stripId(expenses).map((expense: any) => {
      const participants = participantsByExpense.get(expense.id) || []
      return {
        ...expense,
        participant_ids: participants.map((ep: any) => ep.person_id),
        participant_names: participants
          .map((ep: any) => nameMap.get(ep.person_id) || '')
          .filter(Boolean),
        paid_by_name: expense.paid_by ? nameMap.get(expense.paid_by) || null : null,
      }
    })
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch expenses',
    })
  }
})
