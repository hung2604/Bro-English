import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Expense ID is required'
    })
  }

  try {
    const deleteExpense = db.prepare('DELETE FROM expenses WHERE id = ?')
    const result = deleteExpense.run(parseInt(id))

    if (result.changes === 0) {
      throw createError({
        statusCode: 404,
        message: 'Expense not found'
      })
    }

    return { success: true }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to delete expense'
    })
  }
})

