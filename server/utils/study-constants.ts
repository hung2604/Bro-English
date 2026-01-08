// Default values for study settings
export const DEFAULT_NEW_WORDS_PER_DAY = 10
export const DEFAULT_MAX_REVIEWS_PER_DAY = 50

// Algorithm constants
export const INITIAL_EASE_FACTOR = 2.5
export const MIN_EASE_FACTOR = 1.3
export const MAX_EASE_FACTOR = 2.5
export const EASE_FACTOR_CHANGE = 0.15

// Initial intervals based on rating (for first time learning)
export const INITIAL_INTERVALS = {
  1: 1, // Rating 1 (Don't remember): 1 day
  2: 1, // Rating 2 (Hard): 1 day
  3: 3, // Rating 3 (Normal): 3 days
  4: 3, // Rating 4 (Easy): 3 days
}


