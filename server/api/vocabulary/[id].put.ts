import { col, nextId } from '../../utils/db'
import { stripId, personNameMap } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { word, meanings } = body

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Vocabulary ID is required',
    })
  }

  try {
    const vocabId = Number.parseInt(id)
    const vocabCol = await col('vocabulary')
    const meaningsCol = await col('vocabulary_meanings')
    const personsCol = await col('persons')

    const existing = await vocabCol.findOne({ id: vocabId })
    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Vocabulary not found',
      })
    }

    const now = new Date().toISOString()

    if (word) {
      await vocabCol.updateOne(
        { id: vocabId },
        { $set: { word: word.trim(), updated_at: now } },
      )
    }

    if (meanings && Array.isArray(meanings)) {
      await meaningsCol.deleteMany({ vocabulary_id: vocabId })

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
    }

    const vocabulary = await vocabCol.findOne({ id: vocabId })
    const vocabularyMeanings = await meaningsCol
      .find({ vocabulary_id: vocabId })
      .sort({ word_type: 1 })
      .toArray()

    const persons = await personsCol.find({}).toArray()
    const nameMap = personNameMap(persons as any)

    return {
      ...stripId(vocabulary!),
      created_by_name: nameMap.get(vocabulary!.created_by) || null,
      meanings: stripId(vocabularyMeanings),
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: 'Failed to update vocabulary: ' + (error.message || 'Unknown error'),
    })
  }
})
