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
    const defaultPersons = ['Ania', 'Simon', 'Hairy', 'James', 'David']
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

    // Get Charlotte's ID (will be merged into Seb)
    const { data: charlotteData } = await supabase
      .from('persons')
      .select('id')
      .eq('name', 'Charlotte')
      .single()

    const charlottePersonId = charlotteData?.id

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

    // Initialize teachers (exclude Charlotte as it will be merged into Seb)
    teacherIds.forEach((personId: number) => {
      // Skip Charlotte initialization - it will be merged into Seb
      if (charlottePersonId && personId === charlottePersonId) {
        return
      }
      
      personExpenses[personId] = 0
      personPaid[personId] = 0
      // Only Seb receives tuition
      if (sebPersonId && personId === sebPersonId) {
        personPaid[personId] = -totalTuition // Negative means they receive money
      }
    })
    
    // Ensure Seb is initialized if Charlotte exists but Seb wasn't in teacherIds
    if (charlottePersonId && sebPersonId) {
      if (personExpenses[sebPersonId] === undefined) {
        personExpenses[sebPersonId] = 0
        personPaid[sebPersonId] = -totalTuition // Seb receives tuition
      }
    }

    // Add other expenses
    expenses?.forEach((expense: any) => {
      const participantIds = (expense.expense_participants || []).map((ep: any) => ep.person_id)
      const paidBy = expense.paid_by ? parseInt(expense.paid_by) : null
      const amountPerPerson = expense.amount / participantIds.length

      // Handle paid_by person (even if not a participant)
      if (paidBy) {
        const targetPaidBy = (charlottePersonId && sebPersonId && paidBy === charlottePersonId) 
          ? sebPersonId 
          : paidBy
        
        if (targetPaidBy) {
          if (personPaid[targetPaidBy] === undefined) {
            personPaid[targetPaidBy] = 0
          }
          personPaid[targetPaidBy] += expense.amount
        }
      }

      // Handle participants
      participantIds.forEach((personId: number) => {
        // Merge Charlotte into Seb (only if both exist)
        const targetPersonId = (charlottePersonId && sebPersonId && personId === charlottePersonId) 
          ? sebPersonId 
          : personId
        
        if (!targetPersonId) return // Skip if target person doesn't exist
        
        if (personExpenses[targetPersonId] === undefined) {
          personExpenses[targetPersonId] = 0
        }
        if (personPaid[targetPersonId] === undefined) {
          personPaid[targetPersonId] = 0
        }

        personExpenses[targetPersonId] += amountPerPerson
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

    // Collect all person IDs that have expenses or payments
    // This includes default persons, teachers, and any other participants/payers
    const allPersonIdsWithExpenses = new Set<number>()
    
    // Add default persons and teachers (excluding Charlotte)
    defaultPersonIds.forEach(id => allPersonIdsWithExpenses.add(id))
    teacherIds.forEach((personId) => {
      // Exclude Charlotte as it's merged into Seb
      if (!charlottePersonId || personId !== charlottePersonId) {
        allPersonIdsWithExpenses.add(personId)
      }
    })
    
    // Add all persons who have expenses (participants)
    Object.keys(personExpenses).forEach((personIdStr) => {
      const personId = parseInt(personIdStr)
      // Exclude Charlotte as it's merged into Seb
      if (!charlottePersonId || personId !== charlottePersonId) {
        allPersonIdsWithExpenses.add(personId)
      }
    })
    
    // Add all persons who have payments (paid_by)
    Object.keys(personPaid).forEach((personIdStr) => {
      const personId = parseInt(personIdStr)
      // Exclude Charlotte as it's merged into Seb
      if (!charlottePersonId || personId !== charlottePersonId) {
        allPersonIdsWithExpenses.add(personId)
      }
    })
    
    // Convert to array
    const allPersonIds = Array.from(allPersonIdsWithExpenses)
    
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
