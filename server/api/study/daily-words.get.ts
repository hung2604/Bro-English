import { supabase } from '../../utils/db'
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
    const { data: settingsData } = await supabase
      .from('user_study_settings')
      .select('*')
      .eq('person_id', personId)
      .single()

    const settings = settingsData || {
      new_words_per_day: DEFAULT_NEW_WORDS_PER_DAY,
      max_reviews_per_day: DEFAULT_MAX_REVIEWS_PER_DAY,
    }

    // Get words that need review (due today or overdue)
    const { data: wordsToReviewData } = await supabase
      .from('vocabulary_study')
      .select(`
        *,
        vocabulary(*)
      `)
      .eq('person_id', personId)
      .or(`next_review_date.is.null,next_review_date.lte.${today}`)
      .order('last_reviewed_at', { ascending: false, nullsFirst: true })
      .order('next_review_date', { ascending: true })
      .limit(settings.max_reviews_per_day)

    // Calculate days_since_last_review in JavaScript
    const wordsToReview = (wordsToReviewData || []).map((word: any) => {
      const daysSince = word.last_reviewed_at
        ? Math.floor((Date.now() - new Date(word.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999

      return {
        ...word,
        ...word.vocabulary,
        days_since_last_review: daysSince,
      }
    })

    // Get new words (not yet studied by this person)
    const { data: studiedRows } = await supabase
      .from('vocabulary_study')
      .select('vocabulary_id')
      .eq('person_id', personId)

    const studiedWordIds = (studiedRows || []).map((row: any) => row.vocabulary_id)

    let newWords: any[] = []
    if (studiedWordIds.length > 0) {
      const { data: newWordsData } = await supabase
        .from('vocabulary')
        .select('*')
        .not('id', 'in', `(${studiedWordIds.join(',')})`)
        .order('class_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(settings.new_words_per_day)

      newWords = (newWordsData || []).map((word: any) => ({
        ...word,
        study_type: 'new',
        days_since_last_review: 0,
      }))
    } else {
      const { data: newWordsData } = await supabase
        .from('vocabulary')
        .select('*')
        .order('class_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(settings.new_words_per_day)

      newWords = (newWordsData || []).map((word: any) => ({
        ...word,
        study_type: 'new',
        days_since_last_review: 0,
      }))
    }

    // Format review words
    const reviewWords = wordsToReview.map((word: any) => ({
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
