import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  try {
    const { data, error } = await supabase
      .from('persons')
      .select('*')
      .order('name')

    if (error) {
      console.error('Supabase error:', error)
      throw createError({
        statusCode: 500,
        message: `Failed to fetch persons: ${error.message || error.code || 'Unknown error'}`,
      })
    }

    return data || []
  } catch (error: any) {
    console.error('Error in persons/index.get:', error)
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: `Failed to fetch persons: ${error.message || 'Unknown error'}`,
    })
  }
})
