import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const expenseId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { description, amount, date, expenseType, participantIds, paidBy } = body

  if (!expenseId || !description || !amount || !date || !Array.isArray(participantIds)) {
    throw createError({
      statusCode: 400,
      message: 'Expense ID, description, amount, date, and participantIds are required'
    })
  }

  try {
    // Update expense
    const { error: updateError } = await supabase
      .from('expenses')
      .update({
        description,
        amount: parseFloat(amount),
        date,
        expense_type: expenseType || 'other',
        paid_by: paidBy ? parseInt(paidBy) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parseInt(expenseId))

    if (updateError) throw updateError

    // Delete old participants
    await supabase
      .from('expense_participants')
      .delete()
      .eq('expense_id', parseInt(expenseId))

    // Add new participants
    const participants = participantIds.map((personId: unknown) => ({
      expense_id: parseInt(expenseId),
      person_id: typeof personId === 'string' ? parseInt(personId) : (typeof personId === 'number' ? personId : parseInt(String(personId))),
    }))

    const { error: participantsError } = await supabase
      .from('expense_participants')
      .insert(participants)

    if (participantsError) throw participantsError

    // Get the updated expense with participants
    const { data: expense, error: fetchError } = await supabase
      .from('expenses')
      .select(`
        *,
        expense_participants(person_id, persons(name)),
        persons!expenses_paid_by_fkey(name)
      `)
      .eq('id', parseInt(expenseId))
      .single()

    if (fetchError) throw fetchError

    const participantsData = expense.expense_participants || []
    return {
      ...expense,
      participant_ids: participantsData.map((ep: any) => ep.person_id),
      participant_names: participantsData.map((ep: any) => ep.persons?.name || '').filter(Boolean),
      paid_by_name: expense.persons?.name || null,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to update expense'
    })
  }
})
