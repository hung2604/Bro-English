import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Vocabulary ID is required'
    })
  }

  try {
    const deleteStmt = db.prepare('DELETE FROM vocabulary WHERE id = ?')
    const result = deleteStmt.run(parseInt(id))

    if (result.changes === 0) {
      throw createError({
        statusCode: 404,
        message: 'Vocabulary not found'
      })
    }

    return { success: true }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to delete vocabulary'
    })
  }
})

