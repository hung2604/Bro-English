import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const personId = getRouterParam(event, 'personId')

  if (!personId) {
    throw createError({
      statusCode: 400,
      message: 'Person ID is required'
    })
  }

  // Note: class_sessions table doesn't have person_id in the schema
  // This endpoint might need to be adjusted based on your actual schema
  // For now, returning all sessions (global)
  const { data, error } = await supabase
    .from('class_sessions')
    .select('*')
    .order('date')

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch sessions'
    })
  }

  return data || []
})
