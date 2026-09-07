import { col, nextId } from '../../utils/db'
import { stripId } from '../../utils/mongo-helpers'
import { calculateNextReview, calculateNextReviewDate, type Rating } from '../../utils/study-algorithm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, vocabularyId, rating } = body

  if (!userId || !vocabularyId || !rating) {
    throw createError({
      statusCode: 400,
      message: 'User ID, vocabulary ID, and rating are required',
    })
  }

  if (![1, 2, 3, 4].includes(rating)) {
    throw createError({
      statusCode: 400,
      message: 'Rating must be 1, 2, 3, or 4',
    })
  }

  try {
    const personId = Number.parseInt(userId)
    const vocabId = Number.parseInt(vocabularyId)
    const ratingValue = rating as Rating

    const studyCol = await col('vocabulary_study')
    const reviewsCol = await col('vocabulary_reviews')
    const vocabCol = await col('vocabulary')

    let studyRecord = await studyCol.findOne({
      person_id: personId,
      vocabulary_id: vocabId,
    })
    const isFirstTime = !studyRecord

    if (isFirstTime) {
      const now = new Date().toISOString()
      const studyId = await nextId('vocabulary_study')
      const newRecord = {
        id: studyId,
        person_id: personId,
        vocabulary_id: vocabId,
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_date: null,
        last_reviewed_at: now.split('T')[0],
        total_reviews: 0,
        created_at: now,
        updated_at: now,
      }
      await studyCol.insertOne(newRecord as any)
      studyRecord = newRecord as any
    }

    const result = calculateNextReview(
      ratingValue,
      studyRecord!.interval_days || 0,
      studyRecord!.ease_factor || 2.5,
      studyRecord!.repetitions || 0,
      isFirstTime,
    )

    const nextReviewDate = calculateNextReviewDate(result.interval)
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    await studyCol.updateOne(
      { id: studyRecord!.id },
      {
        $set: {
          ease_factor: result.easeFactor,
          interval_days: result.interval,
          repetitions: result.repetitions,
          next_review_date: nextReviewDate,
          last_reviewed_at: today,
          total_reviews: (studyRecord!.total_reviews || 0) + 1,
          updated_at: now,
        },
      },
    )

    const updatedRecord = await studyCol.findOne({ id: studyRecord!.id })
    const vocabulary = await vocabCol.findOne({ id: vocabId })

    const reviewId = await nextId('vocabulary_reviews')
    await reviewsCol.insertOne({
      id: reviewId,
      vocabulary_study_id: studyRecord!.id,
      person_id: personId,
      vocabulary_id: vocabId,
      rating: ratingValue,
      interval_before: studyRecord!.interval_days || 0,
      interval_after: result.interval,
      reviewed_at: now,
    } as any)

    return {
      ...stripId(updatedRecord!),
      ...stripId(vocabulary || {} as any),
      nextReviewDate,
      isFirstTime,
    }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to save review',
    })
  }
})
