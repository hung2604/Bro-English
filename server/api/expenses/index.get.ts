import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { year, month } = query

  try {
    let queryBuilder = supabase
      .from('expenses')
      .select(`
        *,
        expense_participants(person_id, persons(name)),
        persons!expenses_paid_by_fkey(name)
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (year && month) {
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
      queryBuilder = queryBuilder.like('date', `${monthPrefix}%`)
    } else {
      queryBuilder = queryBuilder.limit(100)
    }

    const { data, error } = await queryBuilder

    if (error) throw error

    // Map the result to match the expected format
    const expenses = (data || []).map((expense: any) => {
      const participants = expense.expense_participants || []
      return {
        ...expense,
        participant_ids: participants.map((ep: any) => ep.person_id),
        participant_names: participants.map((ep: any) => ep.persons?.name || '').filter(Boolean),
        paid_by_name: expense.persons?.name || null,
      }
    })

    return expenses
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch expenses'
    })
  }
})
