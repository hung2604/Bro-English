import { col } from '../../utils/db'
import { monthRegex } from '../../utils/mongo-helpers'

interface PersonTotals {
  should_pay: number
  already_paid: number
  tuition_to_receive: number
}

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
    const monthKey = `${year}-${String(month).padStart(2, '0')}`

    const expensesCol = await col('expenses')
    const participantsCol = await col('expense_participants')
    const personsCol = await col('persons')
    const sessionsCol = await col('class_sessions')
    const mergesCol = await col('bill_merges')

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

    // Members who left the class stop sharing tuition from this month (YYYY-MM) onward
    const tuitionEndMonth: Record<string, string> = { Hairy: '2026-10' }
    const defaultPersons = ['Ania', 'Simon', 'Hairy', 'James', 'David']
      .filter(name => !tuitionEndMonth[name] || monthKey < tuitionEndMonth[name])

    const persons = await personsCol.find({}).toArray()
    const personNameMap = new Map<number, string>(persons.map((p: any) => [p.id, p.name]))
    const defaultPersonIds = persons.filter((p: any) => defaultPersons.includes(p.name)).map((p: any) => p.id as number)
    // The teacher collects the tuition the students share
    const teacherId = persons.find((p: any) => p.name === 'Seb')?.id as number | undefined

    const totalClasses = await sessionsCol.countDocuments({
      date: monthPrefix,
      has_class: 1,
    })

    const tuitionPerClass = 750000
    const totalTuition = totalClasses * tuitionPerClass
    const tuitionPerPerson = defaultPersonIds.length > 0
      ? totalTuition / defaultPersonIds.length
      : 0

    const totals = new Map<number, PersonTotals>()
    const totalsOf = (personId: number) => {
      let entry = totals.get(personId)
      if (!entry) {
        entry = { should_pay: 0, already_paid: 0, tuition_to_receive: 0 }
        totals.set(personId, entry)
      }
      return entry
    }

    defaultPersonIds.forEach((personId) => {
      totalsOf(personId).should_pay += tuitionPerPerson
    })
    if (teacherId) {
      totalsOf(teacherId).tuition_to_receive += totalTuition
    }

    expenses.forEach((expense: any) => {
      const participantIds = participantsByExpense.get(expense.id) || []
      const paidBy = expense.paid_by ? Number.parseInt(String(expense.paid_by)) : null
      const amountPerPerson = participantIds.length > 0
        ? expense.amount / participantIds.length
        : 0

      if (paidBy) {
        totalsOf(paidBy).already_paid += expense.amount
      }
      participantIds.forEach((personId: number) => {
        totalsOf(personId).should_pay += amountPerPerson
      })
    })

    // Bill merges: the payer settles the covered person's whole bill, so the covered person's
    // share and payments move onto the payer and they drop out of the list.
    const merges = await mergesCol.find({ month: monthKey }).sort({ id: 1 }).toArray()
    const netOf = (t: PersonTotals) => t.should_pay - t.already_paid - t.tuition_to_receive
    const mergedInto = new Map<number, Array<{ person_id: number, person_name: string, total_amount: number }>>()

    merges.forEach((merge: any) => {
      const covered = totals.get(merge.covered_id)
      const list = mergedInto.get(merge.payer_id) || []
      list.push({
        person_id: merge.covered_id,
        person_name: personNameMap.get(merge.covered_id) || 'Unknown',
        total_amount: Math.round(covered ? netOf(covered) : 0),
      })
      mergedInto.set(merge.payer_id, list)

      const payer = totalsOf(merge.payer_id)
      if (covered) {
        payer.should_pay += covered.should_pay
        payer.already_paid += covered.already_paid
        payer.tuition_to_receive += covered.tuition_to_receive
        totals.delete(merge.covered_id)
      }
    })

    const summary = Array.from(totals.entries()).map(([personId, t]) => ({
      person_id: personId,
      person_name: personNameMap.get(personId) || 'Unknown',
      total_amount: Math.round(netOf(t)),
      should_pay: Math.round(t.should_pay),
      already_paid: Math.round(t.already_paid),
      tuition_to_receive: Math.round(t.tuition_to_receive),
      merged: mergedInto.get(personId) || [],
    }))

    const totalAmountToCollect = summary
      .filter(item => item.total_amount > 0)
      .reduce((sum, item) => sum + item.total_amount, 0)

    const totalAmountToPay = Math.abs(summary
      .filter(item => item.total_amount < 0)
      .reduce((sum, item) => sum + item.total_amount, 0))

    return {
      month: monthKey,
      total_classes: totalClasses,
      total_tuition: totalTuition,
      total_amount: totalAmountToCollect,
      total_to_pay: totalAmountToPay,
      by_person: summary.sort((a, b) => b.total_amount - a.total_amount),
    }
  } catch (error) {
    console.error('Error in expenses/summary.get:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to calculate summary',
    })
  }
})
