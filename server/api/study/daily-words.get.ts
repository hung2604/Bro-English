import { col } from '../../utils/db'
import { stripId } from '../../utils/mongo-helpers'
import { DEFAULT_NEW_WORDS_PER_DAY, DEFAULT_MAX_REVIEWS_PER_DAY } from '../../utils/study-constants'

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
    const today = new Date().toISOString().split('T')[0]

    const settingsCol = await col('user_study_settings')
    const studyCol = await col('vocabulary_study')
    const vocabCol = await col('vocabulary')

    const settingsData = await settingsCol.findOne({ person_id: personId })
    const settings = settingsData || {
      new_words_per_day: DEFAULT_NEW_WORDS_PER_DAY,
      max_reviews_per_day: DEFAULT_MAX_REVIEWS_PER_DAY,
    }

    const wordsToReviewData = await studyCol
      .find({
        person_id: personId,
        $or: [
          { next_review_date: null },
          { next_review_date: { $lte: today } },
        ],
      })
      .sort({ last_reviewed_at: -1, next_review_date: 1 })
      .limit(settings.max_reviews_per_day)
      .toArray()

    const reviewVocabIds = wordsToReviewData.map((w: any) => w.vocabulary_id)
    const reviewVocabs = reviewVocabIds.length > 0
      ? await vocabCol.find({ id: { $in: reviewVocabIds } }).toArray()
      : []
    const vocabById = new Map(reviewVocabs.map((v: any) => [v.id, v]))

    const wordsToReview = wordsToReviewData.map((word: any) => {
      const daysSince = word.last_reviewed_at
        ? Math.floor((Date.now() - new Date(word.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999
      const vocab = vocabById.get(word.vocabulary_id) || {}

      return {
        ...stripId(word),
        ...stripId(vocab as any),
        days_since_last_review: daysSince,
      }
    })

    const studiedRows = await studyCol
      .find({ person_id: personId })
      .project({ vocabulary_id: 1 })
      .toArray()
    const studiedWordIds = studiedRows.map((row: any) => row.vocabulary_id)

    const newWordsFilter = studiedWordIds.length > 0
      ? { id: { $nin: studiedWordIds } }
      : {}

    const newWordsData = await vocabCol
      .find(newWordsFilter)
      .sort({ class_date: -1, created_at: -1 })
      .limit(settings.new_words_per_day)
      .toArray()

    const newWords = stripId(newWordsData).map((word: any) => ({
      ...word,
      study_type: 'new',
      days_since_last_review: 0,
    }))

    const reviewWords = wordsToReview.map((word: any) => ({
      ...word,
      study_type: 'review',
    }))

    const allWords = [...reviewWords, ...newWords]

    return {
      words: allWords,
      stats: {
        newWordsCount: newWords.length,
        reviewWordsCount: reviewWords.length,
        totalCount: allWords.length,
      },
    }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch daily words',
    })
  }
})
