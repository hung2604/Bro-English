import { col, nextId } from '../../utils/db'
import { DEFAULT_NEW_WORDS_PER_DAY, DEFAULT_MAX_REVIEWS_PER_DAY } from '../../utils/study-constants'

interface StudySettingsResponse {
  id: number
  person_id: number
  new_words_per_day: number
  max_reviews_per_day: number
  created_at: string
  updated_at: string
  defaultNewWordsPerDay: number
  defaultMaxReviewsPerDay: number
}

export default defineEventHandler(async (event): Promise<StudySettingsResponse> => {
  const query = getQuery(event)
  const { userId } = query

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required',
    })
  }

  try {
    const personId = Number.parseInt(userId as string)
    const settingsCol = await col('user_study_settings')

    let settings = await settingsCol.findOne({ person_id: personId })

    if (!settings) {
      const now = new Date().toISOString()
      const id = await nextId('user_study_settings')
      const newSettings = {
        id,
        person_id: personId,
        new_words_per_day: DEFAULT_NEW_WORDS_PER_DAY,
        max_reviews_per_day: DEFAULT_MAX_REVIEWS_PER_DAY,
        created_at: now,
        updated_at: now,
      }
      await settingsCol.insertOne(newSettings as any)
      settings = newSettings as any
    }

    if (!settings) {
      throw createError({
        statusCode: 500,
        message: 'Failed to initialize study settings',
      })
    }

    return {
      id: Number(settings.id),
      person_id: Number(settings.person_id),
      new_words_per_day: Number(settings.new_words_per_day),
      max_reviews_per_day: Number(settings.max_reviews_per_day),
      created_at: String(settings.created_at),
      updated_at: String(settings.updated_at),
      defaultNewWordsPerDay: DEFAULT_NEW_WORDS_PER_DAY,
      defaultMaxReviewsPerDay: DEFAULT_MAX_REVIEWS_PER_DAY,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch study settings',
    })
  }
})
