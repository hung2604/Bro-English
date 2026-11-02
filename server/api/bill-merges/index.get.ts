import { col } from '../../utils/db'
import { stripId, personNameMap } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const { year, month } = getQuery(event)

  if (!year || !month) {
    throw createError({
      statusCode: 400,
      message: 'Year and month are required',
    })
  }

  try {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`
    const merges = await (await col('bill_merges')).find({ month: monthKey }).sort({ id: 1 }).toArray()
    const persons = await (await col('persons')).find({}).toArray()
    const nameMap = personNameMap(persons as any)

    return stripId(merges).map((merge: any) => ({
      ...merge,
      payer_name: nameMap.get(merge.payer_id) || 'Unknown',
      covered_name: nameMap.get(merge.covered_id) || 'Unknown',
    }))
  } catch (error: any) {
    console.error('Error in bill-merges/index.get:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch bill merges',
    })
  }
})
