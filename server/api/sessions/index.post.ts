import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, date, hasClass } = body

  if (!userId || !date) {
    throw createError({
      statusCode: 400,
      message: 'User ID and date are required'
    })
  }

  try {
    // Get existing session to track history
    const { data: existingSession } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('date', date)
      .single()

    const previousHasClass = existingSession ? existingSession.has_class : null
    const hasClassValue = hasClass ? 1 : 0

    // Only save history if there's a change
    if (previousHasClass !== hasClassValue) {
      await supabase
        .from('session_history')
        .insert({
          user_id: Number.parseInt(userId),
          date,
          has_class: hasClassValue,
          previous_has_class: previousHasClass,
        })
    }

    // Update or insert session (global, no person_id)
    const { data: session, error } = await supabase
      .from('class_sessions')
      .upsert({
        date,
        has_class: hasClassValue,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'date',
      })
      .select()
      .single()

    if (error) throw error

    return session
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to save session',
    })
  }
})
