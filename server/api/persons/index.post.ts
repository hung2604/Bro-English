import { supabase } from '../../utils/db'

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
    const { data, error } = await supabase
      .from('persons')
      .insert({ name: name.trim() })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation in PostgreSQL
        throw createError({
          statusCode: 409,
          message: 'Person with this name already exists'
        })
      }
      throw error
    }

    return data
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to create person'
    })
  }
})
