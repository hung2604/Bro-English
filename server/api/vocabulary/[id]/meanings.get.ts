import { supabase } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Vocabulary ID is required'
    })
  }

  try {
    const { data, error } = await supabase
      .from('vocabulary_meanings')
      .select('*')
      .eq('vocabulary_id', parseInt(id))
      .order('word_type', { ascending: true })

    if (error) throw error

    return data || []
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch vocabulary meanings'
    })
  }
})

