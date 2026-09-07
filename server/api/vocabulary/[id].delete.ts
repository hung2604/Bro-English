import { col } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

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
    const studyCol = await col('vocabulary_study')
    const reviewsCol = await col('vocabulary_reviews')

    await meaningsCol.deleteMany({ vocabulary_id: vocabId })
    await reviewsCol.deleteMany({ vocabulary_id: vocabId })
    await studyCol.deleteMany({ vocabulary_id: vocabId })
    await vocabCol.deleteOne({ id: vocabId })

    return { success: true }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: 'Failed to delete vocabulary',
    })
  }
})
