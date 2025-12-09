import db from '../../utils/db'
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
    let settings = db.prepare(`
      SELECT * FROM user_study_settings
      WHERE person_id = ?
    `).get(parseInt(userId as string)) as any

    // If no settings exist, create with default values
    if (!settings) {
      const insert = db.prepare(`
        INSERT INTO user_study_settings (person_id, new_words_per_day, max_reviews_per_day, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `)
      insert.run(
        parseInt(userId as string),
        DEFAULT_NEW_WORDS_PER_DAY,
        DEFAULT_MAX_REVIEWS_PER_DAY
      )

      // Get the newly created settings
      settings = db.prepare(`
        SELECT * FROM user_study_settings
        WHERE person_id = ?
      `).get(parseInt(userId as string)) as any
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

