import { col } from '../../utils/db'
import { stripId } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  try {
    const persons = await col('persons')
    const data = await persons.find({}).sort({ name: 1 }).toArray()
    return stripId(data)
  } catch (error: any) {
    console.error('Error in persons/index.get:', error)
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: `Failed to fetch persons: ${error.message || 'Unknown error'}`,
    })
  }
})
