import { col } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Expense ID is required',
    })
  }

  try {
    const expenseId = Number.parseInt(id)
    const expensesCol = await col('expenses')
    const participantsCol = await col('expense_participants')

    await participantsCol.deleteMany({ expense_id: expenseId })
    await expensesCol.deleteOne({ id: expenseId })

    return { success: true }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: 'Failed to delete expense',
    })
  }
})
