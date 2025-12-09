import db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { name } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw createError({
      statusCode: 400,
      message: 'Name is required'
    })
  }

  try {
    const insert = db.prepare('INSERT INTO persons (name) VALUES (?)')
    const result = insert.run(name.trim())
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(result.lastInsertRowid)
    return person
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw createError({
        statusCode: 409,
        message: 'Person with this name already exists'
      })
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to create person'
    })
  }
})

