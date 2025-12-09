import { supabase } from '../../utils/db'
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
    const { data: studyRecordData } = await supabase
      .from('vocabulary_study')
      .select('*')
      .eq('person_id', personId)
      .eq('vocabulary_id', vocabId)
      .single()

    let studyRecord = studyRecordData
    const isFirstTime = !studyRecord

    if (isFirstTime) {
      // Create new study record
      const { data: newRecord, error: insertError } = await supabase
        .from('vocabulary_study')
        .insert({
          person_id: personId,
          vocabulary_id: vocabId,
          ease_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
          next_review_date: null,
          last_reviewed_at: new Date().toISOString().split('T')[0],
          total_reviews: 0,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) throw insertError
      studyRecord = newRecord
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
    const { data: updatedRecord, error: updateError } = await supabase
      .from('vocabulary_study')
      .update({
        ease_factor: result.easeFactor,
        interval_days: result.interval,
        repetitions: result.repetitions,
        next_review_date: nextReviewDate,
        last_reviewed_at: today,
        total_reviews: (studyRecord.total_reviews || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studyRecord.id)
      .select(`
        *,
        vocabulary(*)
      `)
      .single()

    if (updateError) throw updateError

    // Create review history record
    await supabase
      .from('vocabulary_reviews')
      .insert({
        vocabulary_study_id: studyRecord.id,
        person_id: personId,
        vocabulary_id: vocabId,
        rating: ratingValue,
        interval_before: studyRecord.interval_days || 0,
        interval_after: result.interval,
        reviewed_at: new Date().toISOString(),
      })

    return {
      ...updatedRecord,
      ...updatedRecord.vocabulary,
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
