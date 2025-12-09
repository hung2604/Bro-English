import { supabase } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { year, month } = query

  if (!year || !month) {
    throw createError({
      statusCode: 400,
      message: 'Year and month are required'
    })
  }

  try {
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`

    // Get all expenses for the month
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select(`
        *,
        expense_participants(person_id)
      `)
      .like('date', `${monthPrefix}%`)

    if (expensesError) throw expensesError

    // Get class sessions for the month to calculate tuition
    const defaultPersons = ['Ania', 'Simon', 'Heiry', 'James', 'David']
    const teachers = ['Seb', 'Charlotte']

    // Get person IDs
    const { data: defaultPersonsData } = await supabase
      .from('persons')
      .select('id')
      .in('name', defaultPersons)

    const { data: teachersData } = await supabase
      .from('persons')
      .select('id')
      .in('name', teachers)

    const defaultPersonIds = (defaultPersonsData || []).map((p: any) => p.id)
    const teacherIds = (teachersData || []).map((p: any) => p.id)

    // Get Seb's ID
    const { data: sebData } = await supabase
      .from('persons')
      .select('id')
      .eq('name', 'Seb')
      .single()

    const sebPersonId = sebData?.id

    // Count unique dates with classes
    const { count: totalClassesCount } = await supabase
      .from('class_sessions')
      .select('*', { count: 'exact', head: true })
      .like('date', `${monthPrefix}%`)
      .eq('has_class', 1)

    const totalClasses = totalClassesCount || 0
    const tuitionPerClass = 750000
    const totalTuition = totalClasses * tuitionPerClass
    const tuitionPerPerson = totalTuition / defaultPersonIds.length

    // Calculate expenses by person
    const personExpenses: Record<number, number> = {}
    const personPaid: Record<number, number> = {}

    // Initialize with tuition (only for default persons, not teachers)
    defaultPersonIds.forEach((personId: number) => {
      personExpenses[personId] = tuitionPerPerson
      personPaid[personId] = 0
    })

    // Initialize teachers
    teacherIds.forEach((personId: number) => {
      personExpenses[personId] = 0
      personPaid[personId] = 0
      // Only Seb receives tuition
      if (sebPersonId && personId === sebPersonId) {
        personPaid[personId] = -totalTuition // Negative means they receive money
      }
    })

    // Add other expenses
    expenses?.forEach((expense: any) => {
      const participantIds = (expense.expense_participants || []).map((ep: any) => ep.person_id)
      const paidBy = expense.paid_by ? parseInt(expense.paid_by) : null
      const amountPerPerson = expense.amount / participantIds.length

      participantIds.forEach((personId: number) => {
        if (personExpenses[personId] === undefined) {
          personExpenses[personId] = 0
        }
        if (personPaid[personId] === undefined) {
          personPaid[personId] = 0
        }

        personExpenses[personId] += amountPerPerson

        if (paidBy === personId) {
          personPaid[personId] += expense.amount
        }
      })
    })

    // Calculate net amount
    const personNetAmounts: Record<number, number> = {}
    Object.keys(personExpenses).forEach((personIdStr) => {
      const personId = parseInt(personIdStr)
      const shouldPay = personExpenses[personId] ?? 0
      const alreadyPaid = personPaid[personId] ?? 0

      if (alreadyPaid >= 0) {
        personNetAmounts[personId] = shouldPay - alreadyPaid
      } else {
        personNetAmounts[personId] = shouldPay + alreadyPaid
      }
    })

    // Get person names
    const { data: personNames } = await supabase
      .from('persons')
      .select('id, name')

    const personNameMap = new Map((personNames || []).map((p: any) => [p.id, p.name]))

    // Include all persons (default + teachers) in summary
    const allPersonIds = [...defaultPersonIds, ...teacherIds]
    const summary = allPersonIds.map((personId) => {
      const shouldPay = personExpenses[personId] ?? 0
      const alreadyPaid = personPaid[personId] ?? 0

      let netAmount: number
      if (alreadyPaid >= 0) {
        netAmount = shouldPay - alreadyPaid
      } else {
        netAmount = shouldPay + alreadyPaid
      }

      return {
        person_id: personId,
        person_name: personNameMap.get(personId) || 'Unknown',
        total_amount: Math.round(netAmount),
        should_pay: Math.round(shouldPay),
        already_paid: Math.round(alreadyPaid),
      }
    })

    // Total amount should be the sum of money to collect
    const totalAmountToCollect = summary
      .filter(item => item.total_amount > 0)
      .reduce((sum, item) => sum + item.total_amount, 0)

    const totalAmountToPay = Math.abs(summary
      .filter(item => item.total_amount < 0)
      .reduce((sum, item) => sum + item.total_amount, 0))

    return {
      month: `${year}-${String(month).padStart(2, '0')}`,
      total_classes: totalClasses,
      total_tuition: totalTuition,
      total_amount: totalAmountToCollect,
      total_to_pay: totalAmountToPay,
      by_person: summary.sort((a, b) => b.total_amount - a.total_amount),
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to calculate summary'
    })
  }
})
