import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const personId = getRouterParam(event, 'personId')
  
  if (!personId) {
    throw createError({
      statusCode: 400,
      message: 'Person ID is required'
    })
  }

  const sessions = db.prepare(`
    SELECT * FROM class_sessions 
    WHERE person_id = ? 
    ORDER BY date
  `).all(parseInt(personId))

  return sessions
})

