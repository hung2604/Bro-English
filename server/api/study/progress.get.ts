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
    const todayStr = new Date().toISOString().split('T')[0]
    if (!todayStr) {
      throw new Error('Failed to get today date')
    }

    // Get all vocabulary
    const allVocab = db.prepare(`
      SELECT id FROM vocabulary
    `).all() as Array<{ id: number }>

    // Get studied words
    const studiedWords = db.prepare(`
      SELECT 
        vs.*,
        v.word,
        v.class_date
      FROM vocabulary_study vs
      INNER JOIN vocabulary v ON vs.vocabulary_id = v.id
      WHERE vs.person_id = ?
      ORDER BY v.class_date DESC, v.word ASC
    `).all(personId) as any[]

    // Categorize words
    const newWords = allVocab
      .filter(v => !studiedWords.some(s => s.vocabulary_id === v.id))
      .map(v => ({ vocabulary_id: v.id, status: 'new' }))

    const learningWords = studiedWords
      .filter(s => s.repetitions < 3 || s.ease_factor < 2.0)
      .map(s => ({
        vocabulary_id: s.vocabulary_id,
        word: s.word,
        class_date: s.class_date,
        repetitions: s.repetitions,
        ease_factor: s.ease_factor,
        next_review_date: s.next_review_date,
        status: 'learning',
      }))

    const masteredWords = studiedWords
      .filter(s => s.repetitions >= 5 && s.ease_factor >= 2.0)
      .map(s => ({
        vocabulary_id: s.vocabulary_id,
        word: s.word,
        class_date: s.class_date,
        repetitions: s.repetitions,
        ease_factor: s.ease_factor,
        next_review_date: s.next_review_date,
        status: 'mastered',
      }))

    // Words due for review
    const dueWords = studiedWords
      .filter(s => s.next_review_date && s.next_review_date <= todayStr)
      .map(s => ({
        vocabulary_id: s.vocabulary_id,
        word: s.word,
        next_review_date: s.next_review_date,
        days_overdue: s.next_review_date
          ? Math.floor((new Date(todayStr).getTime() - new Date(s.next_review_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      }))

    return {
      newWords: {
        count: newWords.length,
        words: newWords,
      },
      learningWords: {
        count: learningWords.length,
        words: learningWords,
      },
      masteredWords: {
        count: masteredWords.length,
        words: masteredWords,
      },
      dueWords: {
        count: dueWords.length,
        words: dueWords,
      },
      summary: {
        total: allVocab.length,
        new: newWords.length,
        learning: learningWords.length,
        mastered: masteredWords.length,
        due: dueWords.length,
      },
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch progress'
    })
  }
})

