import { col, nextId } from '../utils/db'
import { setClassSessionByAgent } from '../utils/class-sessions'
import type { ToolSpec } from './providers/types'
import type { ResolvedSettings } from './settings'
import { addDays, daysBetween, fold, isDay, vnDate, weekdayOf } from './time'

export type Person = { id: number, name: string }

export type AgentAction = {
  type: 'session' | 'expense_add' | 'expense_update' | 'expense_delete'
  summary: string
  /** Expense id or session date the action touched. */
  ref?: number | string
  dryRun?: boolean
}

export type ToolContext = {
  settings: ResolvedSettings
  persons: Person[]
  actions: AgentAction[]
}

const DATE = { type: 'string', description: 'Date as YYYY-MM-DD' }

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'get_schedule',
    description: 'List the class sessions the app has between two dates (inclusive). Dates without a row have no class.',
    parameters: {
      type: 'object',
      required: ['from', 'to'],
      properties: { from: DATE, to: DATE },
    },
  },
  {
    name: 'set_class_session',
    description: 'Mark one date as having class (tuition is charged) or not having class (no tuition). Use it when the chat shows a class is cancelled, moved, or added.',
    parameters: {
      type: 'object',
      required: ['date', 'has_class', 'reason'],
      properties: {
        date: DATE,
        has_class: { type: 'boolean' },
        reason: { type: 'string', description: 'Short reason in Vietnamese, quoting the chat, for the log' },
      },
    },
  },
  {
    name: 'list_expenses',
    description: 'List shared expenses between two dates (inclusive), with who paid and who shares each one.',
    parameters: {
      type: 'object',
      required: ['from', 'to'],
      properties: { from: DATE, to: DATE },
    },
  },
  {
    name: 'add_expense',
    description: 'Record a shared expense from a bill or transfer receipt photo. Leave out participants to split it between the default group.',
    parameters: {
      type: 'object',
      required: ['description', 'amount', 'date', 'paid_by', 'source_message_id'],
      properties: {
        description: { type: 'string', description: 'Short description in Vietnamese, e.g. "Tiền nước"' },
        amount: { type: 'number', description: 'Total paid, in VND' },
        date: DATE,
        participants: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of everyone who shares the cost. Omit for the default group.',
        },
        paid_by: {
          type: 'string',
          description: 'Name of the person who paid. Use an empty string when it cannot be determined',
        },
        source_message_id: { type: 'number', description: 'The #id of the chat message that carried the photo' },
      },
    },
  },
  {
    name: 'update_expense',
    description: 'Change an expense the agent recorded earlier (for example when a later message says who shares it). Only the given fields change.',
    parameters: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'number' },
        description: { type: 'string' },
        amount: { type: 'number' },
        date: DATE,
        participants: { type: 'array', items: { type: 'string' } },
        paid_by: { type: 'string', description: 'Empty string for unknown' },
      },
    },
  },
  {
    name: 'delete_expense',
    description: 'Remove an expense the agent recorded earlier by mistake (wrong photo, duplicate).',
    parameters: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'number' } },
    },
  },
]

/** Runs one tool call. Always returns a JSON string; problems come back as `{ error }` for the model to read. */
export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  try {
    const result = await dispatch(name, input, ctx)
    return JSON.stringify(result)
  }
  catch (error: unknown) {
    return JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
  }
}

async function dispatch(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case 'get_schedule':
      return scheduleBetween(range(input))
    case 'set_class_session':
      return setClassSession(input, ctx)
    case 'list_expenses':
      return expensesBetween(range(input), ctx.persons)
    case 'add_expense':
      return addExpense(input, ctx)
    case 'update_expense':
      return updateExpense(input, ctx)
    case 'delete_expense':
      return deleteExpense(input, ctx)
    default:
      throw new Error(`Unknown tool ${name}`)
  }
}

function range(input: Record<string, unknown>): { from: string, to: string } {
  if (!isDay(input.from) || !isDay(input.to)) throw new Error('from and to must be dates as YYYY-MM-DD')
  if (input.to < input.from) throw new Error('to is before from')
  if (daysBetween(input.from, input.to) > 92) throw new Error('Ask for at most 3 months at a time')
  return { from: input.from, to: input.to }
}

/** Dates near today only: a date far away is almost certainly a misread. */
function nearDay(value: unknown, pastDays: number, futureDays: number): string {
  if (!isDay(value)) throw new Error('date must be YYYY-MM-DD')
  const today = vnDate()
  if (value < addDays(today, -pastDays) || value > addDays(today, futureDays)) {
    throw new Error(`date ${value} is too far from today (${today}); check the date`)
  }
  return value
}

export async function scheduleBetween({ from, to }: { from: string, to: string }) {
  const sessions = await (await col('class_sessions'))
    .find({ date: { $gte: from, $lte: to } })
    .sort({ date: 1 })
    .toArray()
  return sessions.map(session => ({
    date: session.date as string,
    weekday: weekdayOf(session.date as string),
    has_class: Number(session.has_class) === 1,
  }))
}

async function setClassSession(input: Record<string, unknown>, ctx: ToolContext) {
  const date = nearDay(input.date, 45, 60)
  if (typeof input.has_class !== 'boolean') throw new Error('has_class must be true or false')
  const reason = typeof input.reason === 'string' ? input.reason.slice(0, 300) : ''
  const label = `${date} (${weekdayOf(date)}): ${input.has_class ? 'class' : 'no class'}`

  if (ctx.settings.dryRun) {
    ctx.actions.push({ type: 'session', summary: `${label} — ${reason}`, ref: date, dryRun: true })
    return { ok: true, dry_run: true }
  }
  const { previous, changed } = await setClassSessionByAgent(date, input.has_class, reason)
  if (!changed) return { ok: true, changed: false, note: 'The schedule already says this' }
  ctx.actions.push({ type: 'session', summary: `${label} — ${reason}`, ref: date })
  return { ok: true, changed: true, previous_has_class: previous === null ? null : previous === 1 }
}

export async function expensesBetween({ from, to }: { from: string, to: string }, persons: Person[]) {
  const expenses = await (await col('expenses'))
    .find({ date: { $gte: from, $lte: to } })
    .sort({ date: 1, id: 1 })
    .toArray()
  const ids = expenses.map(expense => expense.id as number)
  const participants = ids.length
    ? await (await col('expense_participants')).find({ expense_id: { $in: ids } }).toArray()
    : []
  const names = new Map(persons.map(person => [person.id, person.name]))
  return expenses.map(expense => ({
    id: expense.id as number,
    date: expense.date as string,
    description: expense.description as string,
    amount: Number(expense.amount),
    paid_by: expense.paid_by ? names.get(expense.paid_by as number) ?? null : null,
    participants: participants
      .filter(row => row.expense_id === expense.id)
      .map(row => names.get(row.person_id as number) ?? `#${row.person_id}`),
    recorded_by: expense.source === 'agent' ? 'agent' : 'someone in the app',
    ...(expense.agent_message_id ? { from_message: `#${expense.agent_message_id}` } : {}),
  }))
}

/** Accepts an app name or a chat name from the alias list. */
function findPerson(name: unknown, ctx: ToolContext): Person {
  if (typeof name !== 'string' || !name.trim()) throw new Error('A person name is required')
  const key = fold(name)
  const alias = ctx.settings.aliases.find(item => fold(item.alias) === key)
  const target = fold(alias?.person ?? name)
  const person = ctx.persons.find(item => fold(item.name) === target)
  if (!person) {
    throw new Error(`Unknown person "${name}". Valid names: ${ctx.persons.map(item => item.name).join(', ')}`)
  }
  return person
}

/** No payer given: null, an empty string, or the word "unknown". */
function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && /^(?:unknown|null|none)?$/i.test(value.trim()))
}

function findPeople(names: unknown, ctx: ToolContext): Person[] {
  if (!Array.isArray(names) || names.length === 0) throw new Error('participants must be a non-empty list of names')
  const people = names.map(name => findPerson(name, ctx))
  return [...new Map(people.map(person => [person.id, person])).values()]
}

function amountOf(value: unknown): number {
  const amount = typeof value === 'number' ? Math.round(value) : Number.NaN
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    throw new Error('amount must be a positive number of VND')
  }
  return amount
}

function descriptionOf(value: unknown): string {
  const description = typeof value === 'string' ? value.trim().slice(0, 200) : ''
  if (!description) throw new Error('description is required')
  return description
}

const money = (amount: number) => `${amount.toLocaleString('en-US')}đ`

async function replaceParticipants(expenseId: number, people: Person[]): Promise<void> {
  const participantsCol = await col('expense_participants')
  await participantsCol.deleteMany({ expense_id: expenseId })
  const now = new Date().toISOString()
  const rows = []
  for (const person of people) {
    rows.push({
      id: await nextId('expense_participants'),
      expense_id: expenseId,
      person_id: person.id,
      created_at: now,
    })
  }
  if (rows.length) await participantsCol.insertMany(rows as any[])
}

async function addExpense(input: Record<string, unknown>, ctx: ToolContext) {
  const description = descriptionOf(input.description)
  const amount = amountOf(input.amount)
  const date = nearDay(input.date, 31, 7)
  const people = input.participants === undefined || input.participants === null
    ? findPeople(ctx.settings.billParticipants, ctx)
    : findPeople(input.participants, ctx)
  const payer = isBlank(input.paid_by) ? null : findPerson(input.paid_by, ctx)
  const messageId = typeof input.source_message_id === 'number' ? input.source_message_id : null

  const expensesCol = await col('expenses')
  // The same photo can reach the agent twice (a retried run): never record it twice.
  if (messageId !== null) {
    const existing = await expensesCol.findOne({ source: 'agent', agent_message_id: messageId, amount })
    if (existing) return { ok: true, id: existing.id, note: 'Already recorded from this message, nothing added' }
  }

  const summary = `${description} ${money(amount)} on ${date}, paid by ${payer?.name ?? 'unknown'}, split: ${people.map(person => person.name).join(', ')}`
  if (ctx.settings.dryRun) {
    ctx.actions.push({ type: 'expense_add', summary, dryRun: true })
    return { ok: true, dry_run: true }
  }

  const now = new Date().toISOString()
  const id = await nextId('expenses')
  await expensesCol.insertOne({
    id,
    description,
    amount,
    date,
    expense_type: 'other',
    paid_by: payer?.id ?? null,
    source: 'agent',
    agent_message_id: messageId,
    created_at: now,
    updated_at: now,
  } as any)
  await replaceParticipants(id, people)
  ctx.actions.push({ type: 'expense_add', summary, ref: id })
  return { ok: true, id }
}

async function agentExpense(id: unknown) {
  if (typeof id !== 'number') throw new Error('id must be a number')
  const expense = await (await col('expenses')).findOne({ id })
  if (!expense) throw new Error(`Expense ${id} not found`)
  if (expense.source !== 'agent') {
    throw new Error(`Expense ${id} was entered by a person in the app; the agent only changes expenses it recorded itself`)
  }
  return expense
}

async function updateExpense(input: Record<string, unknown>, ctx: ToolContext) {
  const expense = await agentExpense(input.id)
  const id = expense.id as number
  const $set: Record<string, unknown> = {}
  const changes: string[] = []

  if (input.description !== undefined) {
    $set.description = descriptionOf(input.description)
    changes.push(`description "${$set.description}"`)
  }
  if (input.amount !== undefined) {
    $set.amount = amountOf(input.amount)
    changes.push(`amount ${money($set.amount as number)}`)
  }
  if (input.date !== undefined) {
    $set.date = nearDay(input.date, 31, 7)
    changes.push(`date ${$set.date}`)
  }
  if (input.paid_by !== undefined) {
    const payer = isBlank(input.paid_by) ? null : findPerson(input.paid_by, ctx)
    $set.paid_by = payer?.id ?? null
    changes.push(`paid by ${payer?.name ?? 'unknown'}`)
  }
  const people = input.participants === undefined ? null : findPeople(input.participants, ctx)
  if (people) changes.push(`split: ${people.map(person => person.name).join(', ')}`)
  if (!changes.length) throw new Error('Nothing to change')

  const summary = `Expense #${id} (${expense.description}): ${changes.join('; ')}`
  if (ctx.settings.dryRun) {
    ctx.actions.push({ type: 'expense_update', summary, ref: id, dryRun: true })
    return { ok: true, dry_run: true }
  }
  if (Object.keys($set).length) {
    await (await col('expenses')).updateOne({ id }, { $set: { ...$set, updated_at: new Date().toISOString() } })
  }
  if (people) await replaceParticipants(id, people)
  ctx.actions.push({ type: 'expense_update', summary, ref: id })
  return { ok: true, id }
}

async function deleteExpense(input: Record<string, unknown>, ctx: ToolContext) {
  const expense = await agentExpense(input.id)
  const id = expense.id as number
  const summary = `Removed expense #${id} (${expense.description}, ${money(Number(expense.amount))})`
  if (ctx.settings.dryRun) {
    ctx.actions.push({ type: 'expense_delete', summary, ref: id, dryRun: true })
    return { ok: true, dry_run: true }
  }
  await (await col('expense_participants')).deleteMany({ expense_id: id })
  await (await col('expenses')).deleteOne({ id })
  ctx.actions.push({ type: 'expense_delete', summary, ref: id })
  return { ok: true }
}
