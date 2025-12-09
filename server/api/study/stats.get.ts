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
    const todayResult = new Date().toISOString().split('T')[0]
    if (!todayResult) {
      throw new Error('Failed to get today date')
    }
    const today: string = todayResult

    // Total vocabulary count
    const { count: totalVocabCount } = await supabase
      .from('vocabulary')
      .select('*', { count: 'exact', head: true })

    // Words studied by this person
    const { count: studiedCount } = await supabase
      .from('vocabulary_study')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', personId)

    // Words due for review today
    const { count: dueTodayCount } = await supabase
      .from('vocabulary_study')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', personId)
      .not('next_review_date', 'is', null)
      .lte('next_review_date', today)

    // Total reviews done
    const { count: totalReviewsCount } = await supabase
      .from('vocabulary_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', personId)

    // Reviews today
    const todayStart = new Date(today).toISOString()
    const todayEnd = new Date(today + 'T23:59:59').toISOString()
    const { count: reviewsTodayCount } = await supabase
      .from('vocabulary_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', personId)
      .gte('reviewed_at', todayStart)
      .lte('reviewed_at', todayEnd)

    // Average ease factor
    const { data: easeFactorData } = await supabase
      .from('vocabulary_study')
      .select('ease_factor')
      .eq('person_id', personId)

    const avgEaseFactor = easeFactorData && easeFactorData.length > 0
      ? easeFactorData.reduce((sum, item) => sum + (item.ease_factor || 0), 0) / easeFactorData.length
      : null

    // Words mastered
    const { count: masteredCount } = await supabase
      .from('vocabulary_study')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', personId)
      .gte('repetitions', 5)
      .gte('ease_factor', 2.0)

    return {
      totalVocabulary: totalVocabCount || 0,
      studiedWords: studiedCount || 0,
      newWords: (totalVocabCount || 0) - (studiedCount || 0),
      dueToday: dueTodayCount || 0,
      totalReviews: totalReviewsCount || 0,
      reviewsToday: reviewsTodayCount || 0,
      averageEaseFactor: avgEaseFactor ? parseFloat(avgEaseFactor.toFixed(2)) : null,
      masteredWords: masteredCount || 0,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch stats'
    })
  }
})
