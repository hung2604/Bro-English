import { col, nextId } from './db'
import { monthRegex } from './mongo-helpers'

/**
 * Creates the default sessions of a month (every Monday and Thursday) unless the month
 * already has any. Returns how many were created.
 */
export async function ensureMonthSessions(year: number, month: number): Promise<number> {
  const sessionsCol = await col('class_sessions')
  const existing = await sessionsCol.find({ date: monthRegex(year, month) }).limit(1).toArray()
  if (existing.length > 0) return 0

  const daysInMonth = new Date(year, month, 0).getDate()
  const now = new Date().toISOString()
  const toInsert: Array<{ date: string, has_class: number, id: number, created_at: string, updated_at: string }> = []

  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = new Date(year, month - 1, day).getDay()
    if (dayOfWeek === 1 || dayOfWeek === 4) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const id = await nextId('class_sessions')
      toInsert.push({
        id,
        date: dateStr,
        has_class: 1,
        created_at: now,
        updated_at: now,
      })
    }
  }

  if (toInsert.length > 0) {
    await sessionsCol.insertMany(toInsert as any[])
  }
  return toInsert.length
}

/**
 * Marks a date as class / no class on behalf of the chat agent, with a history entry.
 * Returns the previous value (`null` when the date had no session yet).
 */
export async function setClassSessionByAgent(date: string, hasClass: boolean, reason: string): Promise<{ previous: number | null, changed: boolean }> {
  const [year, month] = date.split('-').map(Number)
  // A month nobody has opened yet has no sessions: create its defaults first, otherwise
  // this one row would make the month look initialized with a single session.
  await ensureMonthSessions(year!, month!)

  const sessions = await col('class_sessions')
  const history = await col('session_history')
  const existing = await sessions.findOne({ date })
  const previous = existing ? Number(existing.has_class) : null
  const value = hasClass ? 1 : 0
  if (previous === value || (previous === null && !hasClass)) return { previous, changed: false }

  const now = new Date().toISOString()
  await history.insertOne({
    id: await nextId('session_history'),
    user_id: null,
    source: 'agent',
    reason,
    date,
    has_class: value,
    previous_has_class: previous,
    created_at: now,
  } as any)

  if (existing) {
    await sessions.updateOne({ date }, { $set: { has_class: value, updated_at: now } })
  }
  else {
    await sessions.insertOne({
      id: await nextId('class_sessions'),
      date,
      has_class: value,
      created_at: now,
      updated_at: now,
    } as any)
  }
  return { previous, changed: true }
}
