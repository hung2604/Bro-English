import { col } from '../../utils/db'
import { stripId } from '../../utils/mongo-helpers'

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
    const todayStrResult = new Date().toISOString().split('T')[0]
    if (!todayStrResult) {
      throw new Error('Failed to get today date')
    }
    const todayStr: string = todayStrResult

    const vocabCol = await col('vocabulary')
    const studyCol = await col('vocabulary_study')

    const allVocab = await vocabCol.find({}).project({ id: 1 }).toArray()
    const studiedWordsData = await studyCol.find({ person_id: personId }).toArray()

    const vocabIds = studiedWordsData.map((s: any) => s.vocabulary_id)
    const vocabs = vocabIds.length > 0
      ? await vocabCol.find({ id: { $in: vocabIds } }).project({ id: 1, word: 1, class_date: 1 }).toArray()
      : []
    const vocabById = new Map(vocabs.map((v: any) => [v.id, v]))

    const studiedWords = stripId(studiedWordsData).map((s: any) => {
      const vocab = vocabById.get(s.vocabulary_id)
      return {
        ...s,
        vocabulary_id: s.vocabulary_id,
        word: vocab?.word,
        class_date: vocab?.class_date,
      }
    }).sort((a: any, b: any) => {
      const dateCmp = String(b.class_date || '').localeCompare(String(a.class_date || ''))
      if (dateCmp !== 0) return dateCmp
      return String(a.word || '').localeCompare(String(b.word || ''))
    })

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
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch progress',
    })
  }
})
