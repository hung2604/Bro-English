import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { year, month } = body

  if (!year || !month) {
    throw createError({
      statusCode: 400,
      message: 'Year and month are required'
    })
  }

  try {
    const daysInMonth = new Date(year, month, 0).getDate()
    const sessions: Array<{ date: string }> = []

    // Prepare sessions to insert
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.

      // Monday (1) or Thursday (4) - default to has_class = 1
      if (dayOfWeek === 1 || dayOfWeek === 4) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        sessions.push({ date: dateStr })
      }
    }

    // Insert sessions (upsert to avoid conflicts)
    const sessionsToInsert = sessions.map(s => ({
      date: s.date,
      has_class: 1,
      updated_at: new Date().toISOString(),
    }))

    const { error: insertError } = await supabase
      .from('class_sessions')
      .upsert(sessionsToInsert, {
        onConflict: 'date',
        ignoreDuplicates: false,
      })

    if (insertError) throw insertError

    // Return all sessions for the month (global)
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
    const { data: allSessions, error: fetchError } = await supabase
      .from('class_sessions')
      .select('*')
      .like('date', `${monthPrefix}%`)
      .order('date')

    if (fetchError) throw fetchError

    return {
      success: true,
      sessions: allSessions || [],
      initialized: sessions.length,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to initialize sessions'
    })
  }
})
