-- Supabase Database Migration
-- Copy toàn bộ file này và chạy trong Supabase SQL Editor

-- Enable UUID extension (nếu cần)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Persons table
CREATE TABLE IF NOT EXISTS persons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class sessions table
CREATE TABLE IF NOT EXISTS class_sessions (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  has_class INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session history table
CREATE TABLE IF NOT EXISTS session_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  has_class INTEGER NOT NULL,
  previous_has_class INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  expense_type TEXT NOT NULL DEFAULT 'other',
  paid_by INTEGER REFERENCES persons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense participants table
CREATE TABLE IF NOT EXISTS expense_participants (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(expense_id, person_id)
);

-- Vocabulary table
CREATE TABLE IF NOT EXISTS vocabulary (
  id SERIAL PRIMARY KEY,
  word TEXT NOT NULL,
  english_definition TEXT,
  vietnamese_meaning TEXT,
  example_sentence TEXT,
  class_date TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vocabulary study table
CREATE TABLE IF NOT EXISTS vocabulary_study (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  ease_factor REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  next_review_date TEXT,
  last_reviewed_at TEXT,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(person_id, vocabulary_id)
);

-- Vocabulary reviews table
CREATE TABLE IF NOT EXISTS vocabulary_reviews (
  id SERIAL PRIMARY KEY,
  vocabulary_study_id INTEGER NOT NULL REFERENCES vocabulary_study(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  interval_before INTEGER,
  interval_after INTEGER
);

-- User study settings table
CREATE TABLE IF NOT EXISTS user_study_settings (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL UNIQUE REFERENCES persons(id) ON DELETE CASCADE,
  new_words_per_day INTEGER DEFAULT 10,
  max_reviews_per_day INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_class_sessions_date ON class_sessions(date);
CREATE INDEX IF NOT EXISTS idx_session_history_user_date ON session_history(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expense_participants_expense ON expense_participants(expense_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_date ON vocabulary(class_date);
CREATE INDEX IF NOT EXISTS idx_vocabulary_created_by ON vocabulary(created_by);
CREATE INDEX IF NOT EXISTS idx_vocabulary_study_person ON vocabulary_study(person_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_study_vocab ON vocabulary_study(vocabulary_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_study_next_review ON vocabulary_study(next_review_date);
CREATE INDEX IF NOT EXISTS idx_vocabulary_reviews_study ON vocabulary_reviews(vocabulary_study_id);

