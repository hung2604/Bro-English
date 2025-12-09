import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { description, amount, date, expenseType, participantIds, paidBy } = body

  if (!description || !amount || !date || !Array.isArray(participantIds)) {
    throw createError({
      statusCode: 400,
      message: 'Description, amount, date, and participantIds are required'
    })
  }

  try {
    // Insert expense
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        description,
        amount: parseFloat(amount),
        date,
        expense_type: expenseType || 'other',
        paid_by: paidBy ? parseInt(paidBy) : null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (expenseError) throw expenseError

    // Insert participants
    const participants = participantIds.map((personId: unknown) => ({
      expense_id: expense.id,
      person_id: typeof personId === 'string' ? parseInt(personId) : (typeof personId === 'number' ? personId : parseInt(String(personId))),
    }))

    const { error: participantsError } = await supabase
      .from('expense_participants')
      .insert(participants)

    if (participantsError) throw participantsError

    // Get the created expense with participants
    const { data: expenseWithDetails, error: fetchError } = await supabase
      .from('expenses')
      .select(`
        *,
        expense_participants(person_id, persons(name)),
        persons!expenses_paid_by_fkey(name)
      `)
      .eq('id', expense.id)
      .single()

    if (fetchError) throw fetchError

    const participantsData = expenseWithDetails.expense_participants || []
    return {
      ...expenseWithDetails,
      participant_ids: participantsData.map((ep: any) => ep.person_id),
      participant_names: participantsData.map((ep: any) => ep.persons?.name || '').filter(Boolean),
      paid_by_name: expenseWithDetails.persons?.name || null,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create expense'
    })
  }
})
