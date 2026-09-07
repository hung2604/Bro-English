import { col } from '../../utils/db'

export default defineEventHandler(async (event) => {
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
    const todayResult = new Date().toISOString().split('T')[0]
    if (!todayResult) {
      throw new Error('Failed to get today date')
    }
    const today: string = todayResult

    const vocabCol = await col('vocabulary')
    const studyCol = await col('vocabulary_study')
    const reviewsCol = await col('vocabulary_reviews')

    const totalVocabCount = await vocabCol.countDocuments()
    const studiedCount = await studyCol.countDocuments({ person_id: personId })
    const dueTodayCount = await studyCol.countDocuments({
      person_id: personId,
      next_review_date: { $ne: null, $lte: today },
    })
    const totalReviewsCount = await reviewsCol.countDocuments({ person_id: personId })

    const todayStart = new Date(today).toISOString()
    const todayEnd = new Date(today + 'T23:59:59').toISOString()
    const reviewsTodayCount = await reviewsCol.countDocuments({
      person_id: personId,
      reviewed_at: { $gte: todayStart, $lte: todayEnd },
    })

    const easeFactorData = await studyCol
      .find({ person_id: personId })
      .project({ ease_factor: 1 })
      .toArray()

    const avgEaseFactor = easeFactorData.length > 0
      ? easeFactorData.reduce((sum: number, item: any) => sum + (item.ease_factor || 0), 0) / easeFactorData.length
      : null

    const masteredCount = await studyCol.countDocuments({
      person_id: personId,
      repetitions: { $gte: 5 },
      ease_factor: { $gte: 2.0 },
    })

    return {
      totalVocabulary: totalVocabCount || 0,
      studiedWords: studiedCount || 0,
      newWords: (totalVocabCount || 0) - (studiedCount || 0),
      dueToday: dueTodayCount || 0,
      totalReviews: totalReviewsCount || 0,
      reviewsToday: reviewsTodayCount || 0,
      averageEaseFactor: avgEaseFactor ? Number.parseFloat(avgEaseFactor.toFixed(2)) : null,
      masteredWords: masteredCount || 0,
    }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch stats',
    })
  }
})
