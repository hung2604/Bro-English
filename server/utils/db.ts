import Database from 'better-sqlite3'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

// On Vercel (serverless), use /tmp directory which is writable
// In local development, use .data directory
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
const dbDir = isVercel ? '/tmp' : join(process.cwd(), '.data')

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const dbPath = join(dbDir, 'tuition.db')
const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS class_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    has_class INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS session_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    has_class INTEGER NOT NULL,
    previous_has_class INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES persons(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    expense_type TEXT NOT NULL DEFAULT 'other',
    paid_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paid_by) REFERENCES persons(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS expense_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(expense_id, person_id),
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    english_definition TEXT,
    vietnamese_meaning TEXT,
    example_sentence TEXT,
    class_date TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES persons(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS vocabulary_study (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL,
    vocabulary_id INTEGER NOT NULL,
    ease_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    next_review_date TEXT,
    last_reviewed_at TEXT,
    total_reviews INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(person_id, vocabulary_id),
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
    FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS vocabulary_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vocabulary_study_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL,
    vocabulary_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    interval_before INTEGER,
    interval_after INTEGER,
    FOREIGN KEY (vocabulary_study_id) REFERENCES vocabulary_study(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
    FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_study_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL UNIQUE,
    new_words_per_day INTEGER DEFAULT 10,
    max_reviews_per_day INTEGER DEFAULT 50,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
  );

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
`)

// Initialize default persons if they don't exist
const defaultPersons = ['Ania', 'Simon', 'Heiry', 'James', 'David']
const teachers = ['Seb', 'Charlotte']
const allPersons = [...defaultPersons, ...teachers]

const existingPersons = db.prepare('SELECT name FROM persons').all() as { name: string }[]
const existingNames = new Set(existingPersons.map(p => p.name))

const insertPerson = db.prepare('INSERT OR IGNORE INTO persons (name) VALUES (?)')
for (const name of allPersons) {
  if (!existingNames.has(name)) {
    insertPerson.run(name)
  }
}

export default db
