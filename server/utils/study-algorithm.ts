import {
  INITIAL_EASE_FACTOR,
  MIN_EASE_FACTOR,
  MAX_EASE_FACTOR,
  EASE_FACTOR_CHANGE,
  INITIAL_INTERVALS,
} from './study-constants'

export type Rating = 1 | 2 | 3 | 4

export interface StudyResult {
  interval: number
  repetitions: number
  easeFactor: number
}

/**
 * Calculate next review date and update study parameters based on rating
 */
export function calculateNextReview(
  rating: Rating,
  currentInterval: number,
  easeFactor: number,
  repetitions: number,
  isFirstTime: boolean = false
): StudyResult {
  // First time learning a word
  if (isFirstTime) {
    const initialInterval = INITIAL_INTERVALS[rating]
    return {
      interval: initialInterval,
      repetitions: rating >= 3 ? 1 : 0,
      easeFactor: INITIAL_EASE_FACTOR,
    }
  }

  // Rating 1 (Don't remember): Reset
  if (rating === 1) {
    return {
      interval: 1,
      repetitions: 0,
      easeFactor: easeFactor, // Keep ease factor
    }
  }

  // Calculate new ease factor
  let newEaseFactor = easeFactor
  if (rating === 2) {
    // Hard: decrease ease factor
    newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor - EASE_FACTOR_CHANGE)
  } else if (rating === 4) {
    // Easy: increase ease factor
    newEaseFactor = Math.min(MAX_EASE_FACTOR, easeFactor + EASE_FACTOR_CHANGE)
  }
  // Rating 3 (Normal): keep ease factor unchanged

  // Calculate new interval
  const newInterval = Math.round(currentInterval * newEaseFactor)

  // Update repetitions
  const newRepetitions = rating >= 3 ? repetitions + 1 : repetitions

  return {
    interval: newInterval,
    repetitions: newRepetitions,
    easeFactor: newEaseFactor,
  }
}

/**
 * Calculate next review date from interval
 */
export function calculateNextReviewDate(intervalDays: number): string {
  const today = new Date()
  const nextDate = new Date(today)
  nextDate.setDate(today.getDate() + intervalDays)
  const isoString = nextDate.toISOString()
  const datePart = isoString.split('T')[0]
  if (!datePart || datePart.length === 0) {
    throw new Error('Failed to calculate next review date')
  }
  return datePart as string
}

/**
 * Get days since last review
 */
export function getDaysSinceLastReview(lastReviewedAt: string | null): number {
  if (!lastReviewedAt) return 999 // Never reviewed
  const lastDate = new Date(lastReviewedAt)
  const today = new Date()
  const diffTime = today.getTime() - lastDate.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

