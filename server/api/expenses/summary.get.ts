import { col } from '../../utils/db'
import { monthRegex } from '../../utils/mongo-helpers'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { year, month } = query

  if (!year || !month) {
    throw createError({
      statusCode: 400,
      message: 'Year and month are required',
    })
  }

  try {
    const monthPrefix = monthRegex(year as string, month as string)

    const expensesCol = await col('expenses')
    const participantsCol = await col('expense_participants')
    const personsCol = await col('persons')
    const sessionsCol = await col('class_sessions')

    const expenses = await expensesCol.find({ date: monthPrefix }).toArray()
    const expenseIds = expenses.map((e: any) => e.id)
    const allParticipants = expenseIds.length > 0
      ? await participantsCol.find({ expense_id: { $in: expenseIds } }).toArray()
      : []

    const participantsByExpense = new Map<number, number[]>()
    for (const ep of allParticipants) {
      const list = participantsByExpense.get(ep.expense_id) || []
      list.push(ep.person_id)
      participantsByExpense.set(ep.expense_id, list)
    }

    const defaultPersons = ['Ania', 'Simon', 'Hairy', 'James', 'David']
    const teachers = ['Seb', 'Charlotte']

    const defaultPersonsData = await personsCol.find({ name: { $in: defaultPersons } }).toArray()
    const teachersData = await personsCol.find({ name: { $in: teachers } }).toArray()

    const defaultPersonIds = defaultPersonsData.map((p: any) => p.id)
    const teacherIds = teachersData.map((p: any) => p.id)

    const sebData = await personsCol.findOne({ name: 'Seb' })
    const sebPersonId = sebData?.id as number | undefined

    const charlotteData = await personsCol.findOne({ name: 'Charlotte' })
    const charlottePersonId = charlotteData?.id as number | undefined

    const totalClasses = await sessionsCol.countDocuments({
      date: monthPrefix,
      has_class: 1,
    })

    const tuitionPerClass = 750000
    const totalTuition = totalClasses * tuitionPerClass
    const tuitionPerPerson = defaultPersonIds.length > 0
      ? totalTuition / defaultPersonIds.length
      : 0

    const personExpenses: Record<number, number> = {}
    const personPaid: Record<number, number> = {}

    defaultPersonIds.forEach((personId: number) => {
      personExpenses[personId] = tuitionPerPerson
      personPaid[personId] = 0
    })

    teacherIds.forEach((personId: number) => {
      if (charlottePersonId && personId === charlottePersonId) return
      personExpenses[personId] = 0
      personPaid[personId] = 0
      if (sebPersonId && personId === sebPersonId) {
        personPaid[personId] = -totalTuition
      }
    })

    if (charlottePersonId && sebPersonId) {
      if (personExpenses[sebPersonId] === undefined) {
        personExpenses[sebPersonId] = 0
        personPaid[sebPersonId] = -totalTuition
      }
    }

    expenses.forEach((expense: any) => {
      const participantIds = participantsByExpense.get(expense.id) || []
      const paidBy = expense.paid_by ? Number.parseInt(String(expense.paid_by)) : null
      const amountPerPerson = participantIds.length > 0
        ? expense.amount / participantIds.length
        : 0

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

      participantIds.forEach((personId: number) => {
        const targetPersonId = (charlottePersonId && sebPersonId && personId === charlottePersonId)
          ? sebPersonId
          : personId

        if (!targetPersonId) return

        if (personExpenses[targetPersonId] === undefined) {
          personExpenses[targetPersonId] = 0
        }
        if (personPaid[targetPersonId] === undefined) {
          personPaid[targetPersonId] = 0
        }

        personExpenses[targetPersonId] += amountPerPerson
      })
    })

    const persons = await personsCol.find({}).toArray()
    const personNameMap = new Map(persons.map((p: any) => [p.id, p.name]))

    const allPersonIdsWithExpenses = new Set<number>()

    defaultPersonIds.forEach(id => allPersonIdsWithExpenses.add(id))
    teacherIds.forEach((personId) => {
      if (!charlottePersonId || personId !== charlottePersonId) {
        allPersonIdsWithExpenses.add(personId)
      }
    })

    Object.keys(personExpenses).forEach((personIdStr) => {
      const personId = Number.parseInt(personIdStr)
      if (!charlottePersonId || personId !== charlottePersonId) {
        allPersonIdsWithExpenses.add(personId)
      }
    })

    Object.keys(personPaid).forEach((personIdStr) => {
      const personId = Number.parseInt(personIdStr)
      if (!charlottePersonId || personId !== charlottePersonId) {
        allPersonIdsWithExpenses.add(personId)
      }
    })

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
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Failed to calculate summary',
    })
  }
})
