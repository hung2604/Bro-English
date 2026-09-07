import { col } from '../../utils/db'
import { stripId } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, newWordsPerDay, maxReviewsPerDay } = body

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required',
    })
  }

  if (newWordsPerDay !== undefined && (newWordsPerDay < 1 || newWordsPerDay > 100)) {
    throw createError({
      statusCode: 400,
      message: 'New words per day must be between 1 and 100',
    })
  }

  if (maxReviewsPerDay !== undefined && (maxReviewsPerDay < 1 || maxReviewsPerDay > 500)) {
    throw createError({
      statusCode: 400,
      message: 'Max reviews per day must be between 1 and 500',
    })
  }

  try {
    const personId = Number.parseInt(userId)
    const settingsCol = await col('user_study_settings')

    const existing = await settingsCol.findOne({ person_id: personId })
    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Settings not found. Please get settings first to initialize.',
      })
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (newWordsPerDay !== undefined) {
      updateData.new_words_per_day = Number.parseInt(newWordsPerDay)
    }

    if (maxReviewsPerDay !== undefined) {
      updateData.max_reviews_per_day = Number.parseInt(maxReviewsPerDay)
    }

    await settingsCol.updateOne({ person_id: personId }, { $set: updateData })
    const settings = await settingsCol.findOne({ person_id: personId })
    return stripId(settings!)
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: 'Failed to update study settings',
    })
  }
})
