import { supabase } from '../../utils/db'
import { DEFAULT_NEW_WORDS_PER_DAY, DEFAULT_MAX_REVIEWS_PER_DAY } from '../../utils/study-constants'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { userId } = query

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    })
  }

  try {
    // Try to get existing settings
    const { data: settingsData } = await supabase
      .from('user_study_settings')
      .select('*')
      .eq('person_id', parseInt(userId as string))
      .single()

    // If no settings exist, create with default values
    let settings = settingsData
    if (!settings) {
      const { data: newSettings, error: insertError } = await supabase
        .from('user_study_settings')
        .insert({
          person_id: parseInt(userId as string),
          new_words_per_day: DEFAULT_NEW_WORDS_PER_DAY,
          max_reviews_per_day: DEFAULT_MAX_REVIEWS_PER_DAY,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) throw insertError
      settings = newSettings
    }

    return {
      ...settings,
      defaultNewWordsPerDay: DEFAULT_NEW_WORDS_PER_DAY,
      defaultMaxReviewsPerDay: DEFAULT_MAX_REVIEWS_PER_DAY,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch study settings'
    })
  }
})
