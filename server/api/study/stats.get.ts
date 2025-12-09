import db from '../../utils/db'

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

    // Total vocabulary count
    const totalVocab = db.prepare(`
      SELECT COUNT(*) as count FROM vocabulary
    `).get() as { count: number }

    // Words studied by this person
    const studiedCount = db.prepare(`
      SELECT COUNT(*) as count FROM vocabulary_study WHERE person_id = ?
    `).get(personId) as { count: number }

    // Words due for review today
    const dueTodayCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM vocabulary_study 
      WHERE person_id = ? 
        AND next_review_date IS NOT NULL 
        AND next_review_date <= ?
    `).get(personId, today) as { count: number }

    // Total reviews done
    const totalReviews = db.prepare(`
      SELECT COUNT(*) as count 
      FROM vocabulary_reviews 
      WHERE person_id = ?
    `).get(personId) as { count: number }

    // Reviews today
    const reviewsToday = db.prepare(`
      SELECT COUNT(*) as count 
      FROM vocabulary_reviews 
      WHERE person_id = ? 
        AND DATE(reviewed_at) = DATE('now')
    `).get(personId) as { count: number }

    // Average ease factor (how well they're doing)
    const avgEaseFactor = db.prepare(`
      SELECT AVG(ease_factor) as avg 
      FROM vocabulary_study 
      WHERE person_id = ?
    `).get(personId) as { avg: number | null }

    // Words mastered (high repetitions and ease factor)
    const masteredCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM vocabulary_study 
      WHERE person_id = ? 
        AND repetitions >= 5 
        AND ease_factor >= 2.0
    `).get(personId) as { count: number }

    return {
      totalVocabulary: totalVocab.count,
      studiedWords: studiedCount.count,
      newWords: totalVocab.count - studiedCount.count,
      dueToday: dueTodayCount.count,
      totalReviews: totalReviews.count,
      reviewsToday: reviewsToday.count,
      averageEaseFactor: avgEaseFactor.avg ? parseFloat(avgEaseFactor.avg.toFixed(2)) : null,
      masteredWords: masteredCount.count,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch stats'
    })
  }
})

