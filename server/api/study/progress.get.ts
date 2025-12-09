import { supabase } from '../../utils/db'

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
    const todayStrResult = new Date().toISOString().split('T')[0]
    if (!todayStrResult) {
      throw new Error('Failed to get today date')
    }
    const todayStr: string = todayStrResult

    // Get all vocabulary
    const { data: allVocabData } = await supabase
      .from('vocabulary')
      .select('id')

    const allVocab = allVocabData || []

    // Get studied words
    const { data: studiedWordsData } = await supabase
      .from('vocabulary_study')
      .select(`
        *,
        vocabulary(word, class_date)
      `)
      .eq('person_id', personId)
      .order('vocabulary(class_date)', { ascending: false })
      .order('vocabulary(word)', { ascending: true })

    const studiedWords = (studiedWordsData || []).map((s: any) => ({
      ...s,
      vocabulary_id: s.vocabulary_id,
      word: s.vocabulary?.word,
      class_date: s.vocabulary?.class_date,
    }))

    // Categorize words
    const newWords = allVocab
      .filter((v: any) => !studiedWords.some((s: any) => s.vocabulary_id === v.id))
      .map((v: any) => ({ vocabulary_id: v.id, status: 'new' }))

    const learningWords = studiedWords
      .filter((s: any) => s.repetitions < 3 || s.ease_factor < 2.0)
      .map((s: any) => ({
        vocabulary_id: s.vocabulary_id,
        word: s.word,
        class_date: s.class_date,
        repetitions: s.repetitions,
        ease_factor: s.ease_factor,
        next_review_date: s.next_review_date,
        status: 'learning',
      }))

    const masteredWords = studiedWords
      .filter((s: any) => s.repetitions >= 5 && s.ease_factor >= 2.0)
      .map((s: any) => ({
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
      .filter((s: any) => s.next_review_date && s.next_review_date <= todayStr)
      .map((s: any) => ({
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
