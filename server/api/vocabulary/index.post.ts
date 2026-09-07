import { col, nextId } from '../../utils/db'
import { stripId, personNameMap } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { word, meanings, classDate, userId } = body

  if (!word || !classDate || !userId) {
    throw createError({
      statusCode: 400,
      message: 'Word, class date, and user ID are required',
    })
  }

  if (!meanings || !Array.isArray(meanings) || meanings.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'At least one meaning is required',
    })
  }

  try {
    const vocabCol = await col('vocabulary')
    const meaningsCol = await col('vocabulary_meanings')
    const personsCol = await col('persons')

    const now = new Date().toISOString()
    const vocabId = await nextId('vocabulary')
    const vocabulary = {
      id: vocabId,
      word: word.trim(),
      english_definition: null,
      vietnamese_meaning: null,
      example_sentence: null,
      class_date: classDate,
      created_by: Number.parseInt(userId),
      created_at: now,
      updated_at: now,
    }

    await vocabCol.insertOne(vocabulary as any)

    const meaningsToInsert = []
    for (const m of meanings) {
      if (!m.wordType || !m.wordType.trim()) continue
      const meaningId = await nextId('vocabulary_meanings')
      meaningsToInsert.push({
        id: meaningId,
        vocabulary_id: vocabId,
        word_type: m.wordType.trim(),
        english_definition: m.englishDefinition?.trim() || null,
        vietnamese_meaning: m.vietnameseMeaning?.trim() || null,
        example_sentence: m.exampleSentence?.trim() || null,
        created_at: now,
        updated_at: now,
      })
    }

    if (meaningsToInsert.length > 0) {
      await meaningsCol.insertMany(meaningsToInsert as any[])
    }

    const persons = await personsCol.find({}).toArray()
    const nameMap = personNameMap(persons as any)

    return {
      ...stripId(vocabulary as any),
      created_by_name: nameMap.get(vocabulary.created_by) || null,
      meanings: meaningsToInsert.map(m => stripId(m as any)),
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create vocabulary: ' + (error.message || 'Unknown error'),
    })
  }
})
