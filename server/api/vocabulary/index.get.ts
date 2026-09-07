import { col } from '../../utils/db'
import { monthRegex, stripId, personNameMap } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { date, year, month } = query

  try {
    const vocabCol = await col('vocabulary')
    const meaningsCol = await col('vocabulary_meanings')
    const personsCol = await col('persons')

    let filter: Record<string, any> = {}
    if (date) {
      filter = { class_date: date as string }
    } else if (year && month) {
      filter = { class_date: monthRegex(year as string, month as string) }
    }

    const data = await vocabCol
      .find(filter)
      .sort({ class_date: -1, created_at: -1 })
      .toArray()

    const persons = await personsCol.find({}).toArray()
    const nameMap = personNameMap(persons as any)

    const vocabIds = data.map((item: any) => item.id)
    const allMeanings = vocabIds.length > 0
      ? await meaningsCol.find({ vocabulary_id: { $in: vocabIds } }).sort({ word_type: 1 }).toArray()
      : []

    const meaningsByVocab = new Map<number, any[]>()
    for (const m of allMeanings) {
      const list = meaningsByVocab.get(m.vocabulary_id) || []
      list.push(stripId(m))
      meaningsByVocab.set(m.vocabulary_id, list)
    }

    return stripId(data).map((item: any) => ({
      ...item,
      created_by_name: nameMap.get(item.created_by) || null,
      meanings: meaningsByVocab.get(item.id) || [],
    }))
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch vocabulary',
    })
  }
})
