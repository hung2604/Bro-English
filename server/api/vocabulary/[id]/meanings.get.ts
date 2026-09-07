import { col } from '../../../utils/db'
import { stripId } from '../../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Vocabulary ID is required',
    })
  }

  try {
    const meaningsCol = await col('vocabulary_meanings')
    const data = await meaningsCol
      .find({ vocabulary_id: Number.parseInt(id) })
      .sort({ word_type: 1 })
      .toArray()

    return stripId(data)
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch vocabulary meanings',
    })
  }
})
