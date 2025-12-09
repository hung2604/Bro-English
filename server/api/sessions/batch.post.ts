import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { personId, sessions } = body

  if (!personId || !Array.isArray(sessions)) {
    throw createError({
      statusCode: 400,
      message: 'Person ID and sessions array are required'
    })
  }

  try {
    // Note: class_sessions table doesn't have person_id in the schema
    // This endpoint might need to be adjusted based on your actual schema
    // For now, inserting sessions without person_id
    const sessionsToInsert = sessions.map((session: { date: string; hasClass: boolean }) => ({
      date: session.date,
      has_class: session.hasClass ? 1 : 0,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('class_sessions')
      .upsert(sessionsToInsert, {
        onConflict: 'date',
      })

    if (error) throw error

    return { success: true, count: sessions.length }
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to save sessions',
    })
  }
})
