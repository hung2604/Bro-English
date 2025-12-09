import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, newWordsPerDay, maxReviewsPerDay } = body

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    })
  }

  // Validate values
  if (newWordsPerDay !== undefined && (newWordsPerDay < 1 || newWordsPerDay > 100)) {
    throw createError({
      statusCode: 400,
      message: 'New words per day must be between 1 and 100'
    })
  }

  if (maxReviewsPerDay !== undefined && (maxReviewsPerDay < 1 || maxReviewsPerDay > 500)) {
    throw createError({
      statusCode: 400,
      message: 'Max reviews per day must be between 1 and 500'
    })
  }

  try {
    // Check if settings exist
    const { data: existing } = await supabase
      .from('user_study_settings')
      .select('*')
      .eq('person_id', parseInt(userId))
      .single()

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Settings not found. Please get settings first to initialize.'
      })
    }

    // Update settings
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (newWordsPerDay !== undefined) {
      updateData.new_words_per_day = parseInt(newWordsPerDay)
    }

    if (maxReviewsPerDay !== undefined) {
      updateData.max_reviews_per_day = parseInt(maxReviewsPerDay)
    }

    const { data: settings, error: updateError } = await supabase
      .from('user_study_settings')
      .update(updateData)
      .eq('person_id', parseInt(userId))
      .select()
      .single()

    if (updateError) throw updateError

    return settings
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to update study settings'
    })
  }
})
