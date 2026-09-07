import { col, nextId } from '../../utils/db'
import { stripId, isDuplicateKey } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { name } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw createError({
      statusCode: 400,
      message: 'Name is required',
    })
  }

  try {
    const persons = await col('persons')
    const id = await nextId('persons')
    const doc = {
      id,
      name: name.trim(),
      created_at: new Date().toISOString(),
    }
    await persons.insertOne(doc as any)
    return stripId(doc as any)
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    if (isDuplicateKey(error)) {
      throw createError({
        statusCode: 409,
        message: 'Person with this name already exists',
      })
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to create person',
    })
  }
})
