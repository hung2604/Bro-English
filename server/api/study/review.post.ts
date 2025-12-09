import db from '../../utils/db'
import { calculateNextReview, calculateNextReviewDate, type Rating } from '../../utils/study-algorithm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, vocabularyId, rating } = body

  if (!userId || !vocabularyId || !rating) {
    throw createError({
      statusCode: 400,
      message: 'User ID, vocabulary ID, and rating are required'
    })
  }

  if (![1, 2, 3, 4].includes(rating)) {
    throw createError({
      statusCode: 400,
      message: 'Rating must be 1, 2, 3, or 4'
    })
  }

  try {
    const personId = parseInt(userId)
    const vocabId = parseInt(vocabularyId)
    const ratingValue = rating as Rating

    // Get or create vocabulary_study record
    let studyRecord = db.prepare(`
      SELECT * FROM vocabulary_study
      WHERE person_id = ? AND vocabulary_id = ?
    `).get(personId, vocabId) as any

    const isFirstTime = !studyRecord

    if (isFirstTime) {
      // Create new study record
      const insert = db.prepare(`
        INSERT INTO vocabulary_study (
          person_id, vocabulary_id, ease_factor, interval_days, repetitions,
          next_review_date, last_reviewed_at, total_reviews, updated_at
        )
        VALUES (?, ?, 2.5, 0, 0, ?, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP)
      `)
      insert.run(personId, vocabId, null)
      studyRecord = db.prepare(`
        SELECT * FROM vocabulary_study
        WHERE person_id = ? AND vocabulary_id = ?
      `).get(personId, vocabId) as any
    }

    // Calculate next review
    const result = calculateNextReview(
      ratingValue,
      studyRecord.interval_days || 0,
      studyRecord.ease_factor || 2.5,
      studyRecord.repetitions || 0,
      isFirstTime
    )

    const nextReviewDate = calculateNextReviewDate(result.interval)
    const today = new Date().toISOString().split('T')[0]

    // Update vocabulary_study
    const update = db.prepare(`
      UPDATE vocabulary_study
      SET ease_factor = ?,
          interval_days = ?,
          repetitions = ?,
          next_review_date = ?,
          last_reviewed_at = ?,
          total_reviews = total_reviews + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    update.run(
      result.easeFactor,
      result.interval,
      result.repetitions,
      nextReviewDate,
      today,
      studyRecord.id
    )

    // Create review history record
    const insertReview = db.prepare(`
      INSERT INTO vocabulary_reviews (
        vocabulary_study_id, person_id, vocabulary_id, rating,
        interval_before, interval_after, reviewed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    insertReview.run(
      studyRecord.id,
      personId,
      vocabId,
      ratingValue,
      studyRecord.interval_days || 0,
      result.interval
    )

    // Get updated study record with vocabulary info
    const updatedRecord = db.prepare(`
      SELECT 
        vs.*,
        v.word,
        v.english_definition,
        v.vietnamese_meaning,
        v.example_sentence,
        v.class_date
      FROM vocabulary_study vs
      INNER JOIN vocabulary v ON vs.vocabulary_id = v.id
      WHERE vs.id = ?
    `).get(studyRecord.id) as any

    return {
      ...updatedRecord,
      nextReviewDate,
      isFirstTime,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to save review'
    })
  }
})

