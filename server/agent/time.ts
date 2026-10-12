/** The group lives in Vietnam (UTC+7, no daylight saving): all "today" logic uses this zone. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** `YYYY-MM-DD` in Vietnam time. */
export function vnDate(date: Date = new Date()): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

/** `HH:MM` in Vietnam time. */
export function vnTime(date: Date = new Date()): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(11, 16)
}

export function weekdayOf(day: string): string {
  return WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()] ?? ''
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  )
}

/** Start of the Vietnam day containing `date`, as an ISO string. */
export function vnDayStartIso(date: Date = new Date()): string {
  return new Date(new Date(`${vnDate(date)}T00:00:00Z`).getTime() - VN_OFFSET_MS).toISOString()
}

/** Lowercase, no diacritics, no spaces: `Hải` → `hai`, `HUNG LT` → `hunglt`. */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, '')
    .toLowerCase()
}
