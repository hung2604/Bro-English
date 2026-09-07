import { MongoServerError } from 'mongodb'

/** Strip Mongo `_id` from a document (or array of documents). */
export function stripId<T extends Record<string, any>>(doc: T): Omit<T, '_id'>
export function stripId<T extends Record<string, any>>(doc: T[]): Omit<T, '_id'>[]
export function stripId<T extends Record<string, any>>(
  doc: T | T[],
): Omit<T, '_id'> | Omit<T, '_id'>[] {
  if (Array.isArray(doc)) {
    return doc.map(d => {
      const { _id, ...rest } = d
      return rest
    })
  }
  const { _id, ...rest } = doc
  return rest
}

/** Regex for date fields stored as `YYYY-MM-DD` text, matching a month prefix. */
export function monthRegex(year: string | number, month: string | number): RegExp {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  return new RegExp(`^${prefix}`)
}

/** Map Mongo duplicate-key (11000) to a Nuxt 409, otherwise rethrow. */
export function throwIfDuplicate(error: unknown, message: string): never {
  if (error instanceof MongoServerError && error.code === 11000) {
    throw createError({
      statusCode: 409,
      message,
    })
  }
  throw error
}

export function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000
}

/** Build a person name map from an array of person docs. */
export function personNameMap(persons: Array<{ id: number; name: string }>): Map<number, string> {
  return new Map(persons.map(p => [p.id, p.name]))
}
