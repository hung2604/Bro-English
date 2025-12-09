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
    const personId = parseInt(userId as string)
    const today = new Date().toISOString().split('T')[0]

    // Get user settings (or use defaults)
    let settings = db.prepare(`
      SELECT * FROM user_study_settings
      WHERE person_id = ?
    `).get(personId) as any

    if (!settings) {
      // Use defaults if no settings
      settings = {
        new_words_per_day: DEFAULT_NEW_WORDS_PER_DAY,
        max_reviews_per_day: DEFAULT_MAX_REVIEWS_PER_DAY,
      }
    }

    // Get words that need review (due today or overdue)
    const wordsToReview = db.prepare(`
      SELECT 
        vs.*,
        v.word,
        v.english_definition,
        v.vietnamese_meaning,
        v.example_sentence,
        v.class_date,
        CASE 
          WHEN vs.last_reviewed_at IS NULL THEN 999
          ELSE CAST((julianday('now') - julianday(vs.last_reviewed_at)) AS INTEGER)
        END as days_since_last_review
      FROM vocabulary_study vs
      INNER JOIN vocabulary v ON vs.vocabulary_id = v.id
      WHERE vs.person_id = ?
        AND (vs.next_review_date IS NULL OR vs.next_review_date <= ?)
      ORDER BY 
        CASE 
          WHEN vs.last_reviewed_at IS NULL THEN 0
          ELSE CAST((julianday('now') - julianday(vs.last_reviewed_at)) AS INTEGER)
        END DESC,
        vs.next_review_date ASC
      LIMIT ?
    `).all(personId, today, settings.max_reviews_per_day) as any[]

    // Get new words (not yet studied by this person)
    const studiedRows = db.prepare(`
      SELECT vocabulary_id FROM vocabulary_study WHERE person_id = ?
    `).all(personId) as Array<{ vocabulary_id: number }>
    const studiedWordIds = studiedRows.map((row: any) => row.vocabulary_id)

    let newWords: any[] = []
    if (studiedWordIds.length > 0) {
      const placeholders = studiedWordIds.map(() => '?').join(',')
      newWords = db.prepare(`
        SELECT 
          v.*,
          'new' as study_type,
          0 as days_since_last_review
        FROM vocabulary v
        WHERE v.id NOT IN (${placeholders})
        ORDER BY v.class_date DESC, v.created_at DESC
        LIMIT ?
      `).all(...studiedWordIds, settings.new_words_per_day) as any[]
    } else {
      newWords = db.prepare(`
        SELECT 
          v.*,
          'new' as study_type,
          0 as days_since_last_review
        FROM vocabulary v
        ORDER BY v.class_date DESC, v.created_at DESC
        LIMIT ?
      `).all(settings.new_words_per_day) as any[]
    }

    // Format review words
    const reviewWords = wordsToReview.map(word => ({
      ...word,
      study_type: 'review',
    }))

    // Combine and prioritize: reviews first, then new words
    const allWords = [...reviewWords, ...newWords]

    return {
      words: allWords,
      stats: {
        newWordsCount: newWords.length,
        reviewWordsCount: reviewWords.length,
        totalCount: allWords.length,
      },
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch daily words'
    })
  }
})

