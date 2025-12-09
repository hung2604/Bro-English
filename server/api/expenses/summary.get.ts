import db from '../../utils/db'

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
    const expenses = db.prepare(`
      SELECT e.*, 
             GROUP_CONCAT(ep.person_id) as participant_ids
      FROM expenses e
      LEFT JOIN expense_participants ep ON e.id = ep.expense_id
      WHERE e.date LIKE ?
      GROUP BY e.id
    `).all(`${monthPrefix}%`)

    // Get class sessions for the month to calculate tuition
    // Count unique dates with classes (global, not per person - everyone is in the same class)
    const defaultPersons = ['Ania', 'Simon', 'Heiry', 'James', 'David']
    const teachers = ['Seb', 'Charlotte']
    const defaultPersonIds = db.prepare(`
      SELECT id FROM persons WHERE name IN (${defaultPersons.map(() => '?').join(',')})
    `).all(...defaultPersons).map((p: any) => p.id)
    const teacherIds = db.prepare(`
      SELECT id FROM persons WHERE name IN (${teachers.map(() => '?').join(',')})
    `).all(...teachers).map((p: any) => p.id)
    // Only Seb receives tuition, not Charlotte
    const sebId = db.prepare('SELECT id FROM persons WHERE name = ?').get('Seb') as { id: number } | undefined
    const sebPersonId = sebId?.id

    // Count unique dates with classes (global - no person_id filter needed)
    const totalClasses = db.prepare(`
      SELECT COUNT(*) as count
      FROM class_sessions
      WHERE date LIKE ? AND has_class = 1
    `).get(`${monthPrefix}%`) as { count: number }

    const totalClassesCount = totalClasses.count
    const tuitionPerClass = 750000
    const totalTuition = totalClassesCount * tuitionPerClass
    // Tuition is divided among 5 default persons only (not teachers)
    const tuitionPerPerson = totalTuition / defaultPersonIds.length

    // Calculate expenses by person
    // Track what each person should pay and what they already paid
    const personExpenses: Record<number, number> = {}
    const personPaid: Record<number, number> = {}
    
    // Initialize with tuition (only for default persons, not teachers)
    defaultPersonIds.forEach((personId: number) => {
      personExpenses[personId] = tuitionPerPerson
      personPaid[personId] = 0
    })
    
    // Initialize teachers
    // Only Seb receives tuition, Charlotte doesn't receive tuition
    teacherIds.forEach((personId: number) => {
      personExpenses[personId] = 0 // They don't pay anything
      personPaid[personId] = 0
      // Only Seb receives tuition
      if (sebPersonId && personId === sebPersonId) {
        personPaid[personId] = -totalTuition // Negative means they receive money
      }
    })

    // Add other expenses
    expenses.forEach((expense: any) => {
      const participantIds = expense.participant_ids ? expense.participant_ids.split(',').map(Number) : []
      const paidBy = expense.paid_by ? parseInt(expense.paid_by) : null
      const amountPerPerson = expense.amount / participantIds.length

      participantIds.forEach((personId: number) => {
        // Initialize if not exists
        if (personExpenses[personId] === undefined) {
          personExpenses[personId] = 0
        }
        if (personPaid[personId] === undefined) {
          personPaid[personId] = 0
        }
        
        // Add to what they should pay
        personExpenses[personId] += amountPerPerson
        
        // Track what they already paid (subtract from what they owe)
        if (paidBy === personId) {
          personPaid[personId] += expense.amount
        }
      })
    })
    
    // Calculate net amount (what to pay - what already paid)
    // Handle two cases differently:
    // 1. alreadyPaid >= 0 (paid money): netAmount = shouldPay - alreadyPaid
    //    Example: shouldPay = 1.366.667, alreadyPaid = 100.000 → net = 1.366.667 - 100.000 = 1.266.667 ✓
    // 2. alreadyPaid < 0 (received money): netAmount = shouldPay + alreadyPaid
    //    Example: shouldPay = 16.667, alreadyPaid = -6.750.000 → net = 16.667 + (-6.750.000) = -6.733.333 ✓
    const personNetAmounts: Record<number, number> = {}
    Object.keys(personExpenses).forEach((personIdStr) => {
      const personId = parseInt(personIdStr)
      const shouldPay = personExpenses[personId] ?? 0
      const alreadyPaid = personPaid[personId] ?? 0
      // Use different formula based on alreadyPaid sign
      if (alreadyPaid >= 0) {
        // Paid money: subtract from shouldPay
        personNetAmounts[personId] = shouldPay - alreadyPaid
      } else {
        // Received money: add to shouldPay (alreadyPaid is negative)
        personNetAmounts[personId] = shouldPay + alreadyPaid
      }
    })

    // Get person names
    const personNames = db.prepare('SELECT id, name FROM persons').all() as Array<{ id: number; name: string }>
    const personNameMap = new Map(personNames.map(p => [p.id, p.name]))

    // Include all persons (default + teachers) in summary
    const allPersonIds = [...defaultPersonIds, ...teacherIds]
    const summary = allPersonIds.map((personId) => {
      const shouldPay = personExpenses[personId] ?? 0
      const alreadyPaid = personPaid[personId] ?? 0
      // Use same logic as above
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
        already_paid: Math.round(alreadyPaid)
      }
    })

    // Total amount should be the sum of money to collect (only positive amounts - people who need to pay)
    // Negative amounts (people who receive money) are not included in total
    const totalAmountToCollect = summary
      .filter(item => item.total_amount > 0)
      .reduce((sum, item) => sum + item.total_amount, 0)
    
    const totalAmountToPay = Math.abs(summary
      .filter(item => item.total_amount < 0)
      .reduce((sum, item) => sum + item.total_amount, 0))

    return {
      month: `${year}-${String(month).padStart(2, '0')}`,
      total_classes: totalClassesCount,
      total_tuition: totalTuition,
      total_amount: totalAmountToCollect, // Total money to collect from people who need to pay
      total_to_pay: totalAmountToPay, // Total money to pay to people who receive
      by_person: summary.sort((a, b) => b.total_amount - a.total_amount)
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to calculate summary'
    })
  }
})

