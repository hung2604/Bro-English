import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Vocabulary ID is required'
    })
  }

  try {
    const { error } = await supabase
      .from('vocabulary')
      .delete()
      .eq('id', parseInt(id))

    if (error) throw error

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
