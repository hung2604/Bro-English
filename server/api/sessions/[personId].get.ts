import { col } from '../../utils/db'
import { stripId } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const personId = getRouterParam(event, 'personId')

  if (!personId) {
    throw createError({
      statusCode: 400,
      message: 'Person ID is required',
    })
  }

  // class_sessions is global (no person_id)
  const sessions = await col('class_sessions')
  const data = await sessions.find({}).sort({ date: 1 }).toArray()
  return stripId(data)
})
