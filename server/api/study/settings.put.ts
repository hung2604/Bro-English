import db from '../../utils/db'

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
    const existing = db.prepare(`
      SELECT * FROM user_study_settings
      WHERE person_id = ?
    `).get(parseInt(userId)) as any

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Settings not found. Please get settings first to initialize.'
      })
    }

    // Update settings
    const update = db.prepare(`
      UPDATE user_study_settings
      SET new_words_per_day = COALESCE(?, new_words_per_day),
          max_reviews_per_day = COALESCE(?, max_reviews_per_day),
          updated_at = CURRENT_TIMESTAMP
      WHERE person_id = ?
    `)

    update.run(
      newWordsPerDay !== undefined ? parseInt(newWordsPerDay) : null,
      maxReviewsPerDay !== undefined ? parseInt(maxReviewsPerDay) : null,
      parseInt(userId)
    )

    // Get updated settings
    const settings = db.prepare(`
      SELECT * FROM user_study_settings
      WHERE person_id = ?
    `).get(parseInt(userId)) as any

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

